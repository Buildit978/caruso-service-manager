//backend/src/utils/invoiceFinancials.ts
export type FinancialStatus = "paid" | "partial" | "due";

type PaymentLike = { amount: number };
type InvoiceLike = {
  total: number;
  payments: PaymentLike[];
  paidAmount: number;
  balanceDue: number;
  status: "draft" | "sent" | "void";
  paidAt?: Date;
};

const toCents = (n: unknown) =>
  Math.round((typeof n === "number" && Number.isFinite(n) ? n : 0) * 100);

const fromCents = (c: number) => c / 100;

export function computeInvoiceFinancials(inv: Pick<InvoiceLike, "total" | "payments">) {
  const totalC = toCents(inv.total);
  const paidC = (inv.payments || []).reduce((sum, p) => sum + toCents(p.amount), 0);
  const balC = Math.max(0, totalC - paidC);

  const financialStatus: FinancialStatus =
    totalC > 0 && balC === 0 ? "paid" : paidC > 0 ? "partial" : "due";

  return {
    paidAmount: fromCents(paidC),
    balanceDue: fromCents(balC),
    financialStatus,
  };
}

export function applyInvoiceFinancials(inv: InvoiceLike) {
  const fin = computeInvoiceFinancials(inv);

  inv.paidAmount = fin.paidAmount;
  inv.balanceDue = fin.balanceDue;

  // ✅ WRITE THE FINANCIAL STATUS
  (inv as any).financialStatus = fin.financialStatus;

  // ✅ The key fix: if balance is 0, it’s PAID — regardless of method (cheque/cash/etc)
  if (fin.financialStatus === "paid") {
  if (!inv.paidAt) inv.paidAt = new Date();
  }

  return fin;
}
