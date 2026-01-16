// src/utils/outstanding.ts
import type { WorkOrder } from "../types/workOrder";

type FS = "paid" | "partial" | "due";

function toLower(x: any) {
  return String(x ?? "").toLowerCase();
}
function num(x: any) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

/**
 * SINGLE SOURCE OF TRUTH:
 * Outstanding = sentAt exists AND financialStatus is due/partial AND status not paid/void
 * Amount = remaining balance (prefer backend balanceDue)
 */
export function getOutstandingBalance(wo: WorkOrder): number {
  const inv: any = (wo as any)?.invoice;
  if (!inv) return 0;

  const status = toLower(inv.status);
  if (status === "void" || status === "paid") return 0;

  // "Sent" truth is lifecycle stamp (backend)
  if (!inv.sentAt) return 0;

  const fs = inv.financialStatus as FS | undefined;
  if (fs !== "due" && fs !== "partial") return 0;

  // Prefer backend truth (balanceDue). Fall back to total - paidAmount.
  const bal =
    inv.balanceDue != null
      ? num(inv.balanceDue)
      : Math.max(0, num(inv.total) - num(inv.paidAmount));

  return bal > 0 ? bal : 0;
}

export function isOutstanding(wo: WorkOrder): boolean {
  return getOutstandingBalance(wo) > 0;
}
