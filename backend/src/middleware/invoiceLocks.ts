import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import Invoice from "../models/invoice.model";

export async function requireInvoiceEditable(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const accountId = req.accountId;
    if (!accountId) return res.status(400).json({ message: "Missing accountId" });

    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid invoice id" });
    }

    const invoice = await Invoice.findOne({ _id: id, accountId }).select("status financialStatus");
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    const lifecycle = String((invoice as any).status || "draft").toLowerCase(); // draft|sent|void
    const fin = String((invoice as any).financialStatus || "").toLowerCase();  // due|partial|paid

    const lockReason = fin === "paid" ? "paid" : lifecycle;
    const locked = lifecycle === "sent" || lifecycle === "void" || fin === "paid";

    if (locked) {
      return res.status(409).json({
        message: `Invoice is locked (${lockReason}). Draft-only edits are disabled.`,
        code: "INVOICE_LOCKED",
status: lockReason,
      });
    }

    return next();
  } catch (err) {
    return next(err);
  }
}

export async function requireInvoiceNotPaid(req: Request, res: Response, next: NextFunction) {
  try {
    const accountId = req.accountId;
    if (!accountId) return res.status(400).json({ message: "Missing accountId" });

    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid invoice id" });

    const invoice = await Invoice.findOne({ _id: id, accountId }).select("status financialStatus");
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    const fin = String((invoice as any).financialStatus || "").toLowerCase();
    if (fin === "paid") {
      return res.status(409).json({ message: "Paid invoices cannot be changed.", code: "INVOICE_PAID_LOCKED" });
    }

    return next();
  } catch (err) {
    return next(err);
  }
}
