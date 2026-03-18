// frontend/src/utils/workOrderDisplay.ts

type WorkOrderLike = {
  complaint?: string | null;
  diagnosis?: string | null;
  notes?: string | null;
};

/** Primary display text: complaint → diagnosis → notes → "General service" */
export function getWorkOrderTitle(wo: WorkOrderLike | null | undefined): string {
  if (!wo) return "General service";
  const s = (wo.complaint ?? wo.diagnosis ?? wo.notes ?? "").trim();
  return s || "General service";
}

/** Truncate text for compact display */
export function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "…";
}
