    // backend/src/routes/summary.route.ts
import express from "express";
import { Customer } from "../models/customer.model";
import { WorkOrder } from "../models/workOrder.model";
import { Settings } from "../models/settings.model";
import { Invoice } from "../models/invoice.model";
import InvoiceModel from "../models/invoice.model";
import { requireRole } from "../middleware/requireRole";




        const router = express.Router();
        router.use(requireRole(["owner", "manager"]));

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

        /**
         * Get the start of the current year (Jan 1, 00:00:00)
         */
        function getStartOfYear(): Date {
        const now = new Date();
        return new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
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
            const accountId = req.accountId;
            if (!accountId) {
            return res.status(400).json({ message: "Missing accountId" });
            }

            const startOfWeek = getStartOfWeek();
            const startOfYear = getStartOfYear();

            const completedExpr = {
            $eq: [{ $toLower: { $trim: { input: "$status" } } }, "completed"],
            };

            const [
            statusAgg,
            totalCustomers,
            paidAllTimeAgg,
            paidYtdAgg,
            thisWeekAgg,
            settingsDoc,
            ] = await Promise.all([
            // 1) Status counts, but only for this account
            WorkOrder.aggregate([
                { $match: { accountId } },
                {
                $group: {
                    _id: { $toLower: { $trim: { input: "$status" } } },
                    count: { $sum: 1 },
                },
                },
            ]),

            // 2) Customers for this account only
            Customer.countDocuments({ accountId }),

            // 3) ✅ Paid revenue (ALL-TIME) from invoice payments
            InvoiceModel.aggregate([
                { $match: { accountId } },
                { $unwind: "$payments" },
                {
                $group: {
                    _id: null,
                    amount: { $sum: "$payments.amount" },
                },
                },
            ]),

            // 4) ✅ Paid revenue (YTD) + invoiceCount (for avgOrderValueYtd)
            // payments.paidAt is an ISO string, so convert to Date first
           InvoiceModel.aggregate([
  { $match: { accountId } },
  { $unwind: "$payments" },
  { $match: { "payments.paidAt": { $gte: startOfYear } } },

  { $group: { _id: "$_id", invoicePaid: { $sum: "$payments.amount" } } },
  {
    $group: {
      _id: null,
      amount: { $sum: "$invoicePaid" },
      invoiceCount: { $sum: 1 },
    },
  },
]),


            // 5) This week's completed work orders + revenue, scoped by account
            WorkOrder.aggregate([
                {
                $match: {
                    accountId,
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

            // 6) Settings for this account
            Settings.findOne({ accountId }),
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

            // ✅ PAID truth
            const paidAllTime = paidAllTimeAgg[0]?.amount ?? 0;
            const paidYtd = paidYtdAgg[0]?.amount ?? 0;
            const paidYtdInvoiceCount = paidYtdAgg[0]?.invoiceCount ?? 0;

            const avgOrderValueYtd =
            paidYtdInvoiceCount > 0 ? paidYtd / paidYtdInvoiceCount : 0;

            // Keep your settings-based calc for "this week" operational metric
            const taxRateDecimal = settingsDoc?.taxRate ?? 0;
            const discountType = (settingsDoc?.discountType ?? "none") as DiscountType;
            const discountValue = settingsDoc?.discountValue ?? 0;

            const subtotalThisWeek = thisWeekAgg[0]?.revenue ?? 0;
            const workOrdersThisWeek = thisWeekAgg[0]?.count ?? 0;

            const thisWeekAdjusted = applyTaxAndDiscount(
            subtotalThisWeek,
            taxRateDecimal,
            discountType,
            discountValue
            );

            // ✅ Fix drift: totalRevenue should reflect PAID ALL-TIME
            const totalRevenueAdjusted = paidAllTime;

            // Preserve your existing AOV (based on completed WOs) if you're using it elsewhere
            const averageOrderValue =
            completedWorkOrders > 0 ? totalRevenueAdjusted / completedWorkOrders : 0;

            return res.json({
            totalCustomers,
            openWorkOrders,
            completedWorkOrders,

            // ✅ paid-all-time truth (Card #7 if still wired to totalRevenue)
            totalRevenue: totalRevenueAdjusted,

            workOrdersThisWeek,
            revenueThisWeek: thisWeekAdjusted.total,

            averageOrderValue,

            // ✅ new fields for v1 dashboard wiring
            revenuePaidAllTime: { amount: paidAllTime },
            revenuePaidYtd: { amount: paidYtd },
            avgOrderValueYtd,
            });
        } catch (error) {
            console.error("Error in /api/summary:", error);
            return res.status(500).json({ message: "Failed to load summary" });
        }
        });

        export default router;
