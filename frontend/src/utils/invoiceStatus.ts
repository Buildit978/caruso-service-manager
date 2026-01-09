export type InvoiceStatus = "paid" | "partial" | "due" | "void" | "draft";

export function invoiceStatusLabel(status?: string | null) {
  const s = (status || "").toLowerCase();
  switch (s) {
    case "paid":
      return "PAID";
    case "partial":
      return "PARTIAL";
    case "due":
      return "DUE";
    case "void":
      return "VOID";
    case "draft":
      return "DRAFT";
    default:
      return "—";
  }
}

/**
 * Optional: keep all styling decisions centralized.
 * (Still display-only. No financial logic.)
 */
export function invoiceStatusPillClass(status?: string | null) {
  const s = (status || "").toLowerCase();
  switch (s) {
    case "paid":
      return "bg-green-100 text-green-800 border border-green-200";
    case "partial":
      return "bg-yellow-100 text-yellow-800 border border-yellow-200";
    case "due":
      return "bg-red-100 text-red-800 border border-red-200";
    case "void":
      return "bg-gray-100 text-gray-800 border border-gray-200";
    case "draft":
      return "bg-slate-100 text-slate-800 border border-slate-200";
    default:
      return "bg-gray-50 text-gray-500 border border-gray-200";
  }
}
