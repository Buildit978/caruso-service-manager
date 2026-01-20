import express, { Request, Response } from "express";
import InvoiceModel from "../models/invoice.model";
import { requireRole } from "../middleware/requireRole";

const router = express.Router();

router.use(requireRole(["owner", "manager"]));



function getStartOfYear(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
}

router.get("/revenue/ytd-monthly", async (req: Request, res: Response) => {
  try {
    const accountId = req.accountId;
    if (!accountId) return res.status(400).json({ message: "Missing accountId" });

    const startOfYear = getStartOfYear();
    const now = new Date();
    const year = now.getFullYear();

    // Sum payments by month (based on payments.paidAt Date)
    const rows = await InvoiceModel.aggregate([
      { $match: { accountId } },
      { $unwind: { path: "$payments", preserveNullAndEmptyArrays: false } },
      { $match: { "payments.paidAt": { $gte: startOfYear } } },
      {
        $group: {
          _id: { $month: "$payments.paidAt" }, // 1..12
          amount: { $sum: "$payments.amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const byMonth = new Map<number, number>(rows.map((r: any) => [r._id, r.amount]));

    const currentMonth = now.getMonth() + 1; // 1..12
    const months = Array.from({ length: currentMonth }, (_, i) => {
      const month = i + 1;
      return {
        month,
        label: monthNames[i],
        amount: byMonth.get(month) ?? 0,
      };
    });

    const totalYtd = months.reduce((sum, m) => sum + (m.amount ?? 0), 0);

    return res.json({ year, months, totalYtd });
  } catch (err) {
    console.error("Error in GET /api/reports/revenue/ytd-monthly:", err);
    return res.status(500).json({ message: "Failed to load YTD revenue report" });
  }
});

export default router;
