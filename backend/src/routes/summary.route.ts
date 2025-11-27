import express, { Request, Response, Router, NextFunction } from 'express';
import { Customer } from '../models/customer.model';
import { WorkOrder } from '../models/workOrder.model';
import { Settings } from "../models/settings.model"; 
import { attachAccountId } from "../middleware/account.middleware"; // my accountId edit


const router = express.Router();

router.use(attachAccountId); // my accountId edit

/**
 * Get the start of the current week (Monday, 00:00:00)
 */
function getStartOfWeek(): Date {
    const now = new Date();
    const day = now.getDay(); // 0 (Sun) - 6 (Sat)
    const diffToMonday = (day + 6) % 7; // Monday → 0, Tuesday → 1, etc.

    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(now.getDate() - diffToMonday);

    return startOfWeek;
}

type DiscountType = "none" | "percent" | "flat";

function applyTaxAndDiscount(
    baseAmount: number,
    taxRateDecimal: number,
    discountType: DiscountType,
    discountValue: number
) {
    // Guard against weird values
    const safeBase = Math.max(0, baseAmount);
    const safeTax = Math.max(0, Math.min(taxRateDecimal, 1));
    const safeDiscountValue = Math.max(0, discountValue);

    // 1) Apply discount
    let discounted = safeBase;
    let discountAmount = 0;

    if (discountType === "percent") {
        discountAmount = (safeBase * safeDiscountValue) / 100;
        discounted = safeBase - discountAmount;
    } else if (discountType === "flat") {
        discountAmount = Math.min(safeBase, safeDiscountValue);
        discounted = safeBase - discountAmount;
    }

    if (discounted < 0) discounted = 0;

    // 2) Apply tax on the discounted amount
    const taxAmount = discounted * safeTax;
    const total = discounted + taxAmount;

    return {
        baseAmount: safeBase,
        discountAmount,
        taxAmount,
        total,
    };
}


// If this router is mounted as /api/summary in server.ts,
// then router.get('/') is correct.
router.get("/", async (req, res) => {
    try {

        const accountId = req.accountId; // My accountId Edit 
        if (!accountId) {
            return res.status(400).json({ message: "Missing accountId" });
        }   

        const startOfWeek = getStartOfWeek();

       const completedExpr = {
            $eq: [
                { $toLower: { $trim: { input: "$status" } } },
                "completed",
            ],
            };

            const [
            statusAgg,
            totalCustomers,
            allTimeRevenueAgg,
            thisWeekAgg,
            settingsDoc,
            ] = await Promise.all([
            // 1) Status counts, but only for this account
            WorkOrder.aggregate([
                {
                $match: { accountId }, // 👈 scope by account
                },
                {
                $group: {
                    _id: { $toLower: { $trim: { input: "$status" } } },
                    count: { $sum: 1 },
                },
                },
            ]),

            // 2) Customers for this account only
            Customer.countDocuments({ accountId }), // 👈 scope

            // 3) All-time revenue for completed work orders, scoped by account
            WorkOrder.aggregate([
                {
                $match: {
                    accountId, // 👈 scope
                    $expr: completedExpr,
                },
                },
                {
                $group: {
                    _id: null,
                    total: { $sum: "$total" },
                },
                },
            ]),

            // 4) This week's completed work orders + revenue, scoped by account
            WorkOrder.aggregate([
                {
                $match: {
                    accountId, // 👈 scope
                    createdAt: { $gte: startOfWeek },
                    $expr: completedExpr,
                },
                },
                {
                $group: {
                    _id: null,
                    count: { $sum: 1 },
                    revenue: { $sum: "$total" },
                },
                },
            ]),

            // 5) Settings for this account (if Settings is per-account)
            Settings.findOne({ accountId }), // 👈 scope (or leave bare if global)
            ]);


        const statusCounts = statusAgg.reduce(
            (acc: Record<string, number>, row: any) => {
                const key = typeof row._id === "string" ? row._id : "";
                if (key in acc) {
                    acc[key] = row.count;
                }
                return acc;
            },
            {
                open: 0,
                in_progress: 0,
                completed: 0,
                invoiced: 0,
            }
        );

        // Treat "open" as any non-completed/non-invoiced active work order
        const openWorkOrders = statusCounts.open + statusCounts.in_progress;
        const completedWorkOrders = statusCounts.completed;

        const taxRateDecimal = settingsDoc?.taxRate ?? 0;
        const discountType = (settingsDoc?.discountType ?? "none") as DiscountType;
        const discountValue = settingsDoc?.discountValue ?? 0;

        const subtotalAllTime = allTimeRevenueAgg[0]?.total ?? 0;
        const subtotalThisWeek = thisWeekAgg[0]?.revenue ?? 0;
        const workOrdersThisWeek = thisWeekAgg[0]?.count ?? 0;

        const allTimeAdjusted = applyTaxAndDiscount(
            subtotalAllTime,
            taxRateDecimal,
            discountType,
            discountValue
        );

        const thisWeekAdjusted = applyTaxAndDiscount(
            subtotalThisWeek,
            taxRateDecimal,
            discountType,
            discountValue
        );

        const totalRevenueAdjusted = allTimeAdjusted.total;
        const averageOrderValue =
            completedWorkOrders > 0
                ? totalRevenueAdjusted / completedWorkOrders
                : 0;

        return res.json({
            totalCustomers,
            openWorkOrders,
            completedWorkOrders,
            totalRevenue: totalRevenueAdjusted,
            workOrdersThisWeek,
            revenueThisWeek: thisWeekAdjusted.total,
            averageOrderValue,
        });
    } catch (error) {
        console.error("Error in /api/summary:", error);
        return res.status(500).json({ message: "Failed to load summary" });
    }
});

export default router;
