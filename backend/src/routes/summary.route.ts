import express, { Request, Response } from 'express';
import { Customer } from '../models/customer.model';
import { WorkOrder } from '../models/workOrder.model';
import { Settings } from "../models/settings.model"; // 👈 NEW

const router = express.Router();

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
        const startOfWeek = getStartOfWeek();

        const [
            totalCustomers,
            openWorkOrders,
            completedWorkOrders,
            allTimeRevenueAgg,
            thisWeekAgg,
            settingsDoc,
        ] = await Promise.all([
            Customer.countDocuments(),
            WorkOrder.countDocuments({ status: "open" }),
            WorkOrder.countDocuments({ status: "completed" }),
            WorkOrder.aggregate([
                { $match: { status: "completed" } },
                { $group: { _id: null, total: { $sum: "$total" } } },
            ]),
            WorkOrder.aggregate([
                {
                    $match: {
                        status: "completed",
                        createdAt: { $gte: startOfWeek },
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
            Settings.findOne(), // 👈 fetch current shop settings
        ]);

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
