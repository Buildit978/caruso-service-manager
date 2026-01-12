export type InvoiceLifecycleStatus = "draft" | "sent" | "void";
export type InvoiceFinancialStatus = "paid" | "partial" | "due";

export type InvoiceLike = {
  status?: InvoiceLifecycleStatus | string | null;
  financialStatus?: InvoiceFinancialStatus | string | null;
  total?: number | null;
  paidAmount?: number | null;
  balanceDue?: number | null;
};

/**
 * ✅ Authoritative display label
 * Priority:
 * 1) VOID always wins
 * 2) Financial truth (PAID / PARTIAL / DUE)
 * 3) Fallback to lifecycle (DRAFT)
 */
export function invoiceDisplayLabel(invoice?: InvoiceLike | null) {
  if (!invoice) return "—";

  const lifecycle = (invoice.status || "").toLowerCase();
  if (lifecycle === "void") return "VOID";

  const fin = (invoice.financialStatus || "").toLowerCase();
  if (fin === "paid") return "PAID";
  if (fin === "partial") return "PARTIAL";
  if (fin === "due") return "DUE";

  // Fallback: derive from numbers (legacy safety)
  const total = Number(invoice.total ?? 0);
  const paid = Number(invoice.paidAmount ?? 0);
  const bal =
    invoice.balanceDue != null
      ? Number(invoice.balanceDue)
      : Math.max(0, total - paid);

  if (total > 0 && bal <= 0) return "PAID";
  if (paid > 0 && bal > 0) return "PARTIAL";
  if (total > 0) return "DUE";

  return "DRAFT";
}


/**
 * Optional: keep all styling decisions centralized.
 * (Still display-only. No financial logic.)
 */
export function invoiceStatusPillClass(label?: string | null) {
  const s = (label || "").toUpperCase();
  switch (s) {
    case "PAID":
      return "bg-green-100 text-green-800 border border-green-200";
    case "PARTIAL":
      return "bg-yellow-100 text-yellow-800 border border-yellow-200";
    case "DUE":
      return "bg-red-100 text-red-800 border border-red-200";
    case "VOID":
      return "bg-gray-100 text-gray-800 border border-gray-200";
    case "DRAFT":
      return "bg-slate-100 text-slate-800 border border-slate-200";
    default:
      return "bg-gray-50 text-gray-500 border border-gray-200";
  }
}

