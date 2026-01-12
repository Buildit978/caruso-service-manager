import type { WorkOrderStatus } from "../models/workOrder.model";

function normalizeStatus(input: unknown): WorkOrderStatus {
  const raw = String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (raw === "complete") return "completed";
  if (raw === "inprogress") return "in_progress";

  const allowed: WorkOrderStatus[] = [
    "open",
    "in_progress",
    "completed",
    "invoiced",
    "cancelled",
  ];

  return (allowed.includes(raw as WorkOrderStatus) ? raw : "open") as WorkOrderStatus;
}

function normalizeOdometer(input: unknown): number | undefined {
  if (input === null || input === undefined || input === "") return undefined;
  const n =
    typeof input === "number"
      ? input
      : Number(String(input).replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n);
}

type Patch = {
  status?: unknown;

  // legacy single field (keep working)
  odometer?: unknown;

  // new preferred fields
  odometerIn?: unknown;
  odometerOut?: unknown;
  serviceOdometer?: unknown;
};

export function applyWorkOrderLifecycle(workOrder: any, patch: Patch) {
  // ----------------------------
  // Odometer normalization
  // ----------------------------

  // legacy
  if (patch.odometer !== undefined) {
    workOrder.odometer = normalizeOdometer(patch.odometer);
  }

  // new
  if (patch.odometerIn !== undefined) {
    workOrder.odometerIn = normalizeOdometer(patch.odometerIn);
  }
  if (patch.odometerOut !== undefined) {
    workOrder.odometerOut = normalizeOdometer(patch.odometerOut);
  }
  if (patch.serviceOdometer !== undefined) {
    workOrder.serviceOdometer = normalizeOdometer(patch.serviceOdometer);
  }

  // If odometerIn not provided, but legacy odometer exists, treat it as odometerIn (soft backfill)
  if (workOrder.odometerIn === undefined && workOrder.odometer !== undefined) {
    workOrder.odometerIn = workOrder.odometer;
  }

  // If odometer was provided but odometerIn wasn't, keep them in sync (optional but helpful)
  if (patch.odometer !== undefined && patch.odometerIn === undefined) {
    workOrder.odometerIn = workOrder.odometer;
  }

  // Validation rule: out >= in (if both exist)
  if (
    workOrder.odometerIn !== undefined &&
    workOrder.odometerOut !== undefined &&
    workOrder.odometerOut < workOrder.odometerIn
  ) {
    throw new Error("odometerOut cannot be less than odometerIn");
  }

  // ----------------------------
  // Status normalization + timestamps
  // ----------------------------
  const now = new Date();

  // Ensure openedAt exists
  if (!workOrder.openedAt) workOrder.openedAt = now;

  if (patch.status !== undefined) {
    const nextStatus = normalizeStatus(patch.status);
    const prevStatus = (workOrder.status ?? "open") as WorkOrderStatus;

    if (nextStatus !== prevStatus) {
      workOrder.status = nextStatus;

      // Forward transitions: set timestamps once
      if (nextStatus === "completed") {
        if (!workOrder.completedAt) workOrder.completedAt = now;

        // choose best service mileage
        if (!workOrder.serviceOdometer) {
          workOrder.serviceOdometer =
            workOrder.odometerOut ?? workOrder.odometerIn ?? workOrder.odometer ?? undefined;
        }
      }

      if (nextStatus === "invoiced") {
        if (!workOrder.invoicedAt) workOrder.invoicedAt = now;

        // 🔒 closedAt is controlled ONLY by invoice truth (paid/void).
        // Do not set/clear closedAt in lifecycle transitions like completed/invoiced/etc.
        if (!workOrder.closedAt) workOrder.closedAt = now;

        // invoiced implies completed
        if (!workOrder.completedAt) workOrder.completedAt = now;

        if (!workOrder.serviceOdometer) {
          workOrder.serviceOdometer =
            workOrder.odometerOut ?? workOrder.odometerIn ?? workOrder.odometer ?? undefined;
        }
      }

      if (nextStatus === "cancelled") {
        if (!workOrder.cancelledAt) workOrder.cancelledAt = now;
        // 🔒 closedAt is controlled ONLY by invoice truth (paid/void).
        // Do not set/clear closedAt in lifecycle transitions like completed/invoiced/etc.

        if (!workOrder.closedAt) workOrder.closedAt = now;
      }

      // Backwards transitions: clear “final” stamps (keeps data sane)
      if (nextStatus === "open" || nextStatus === "in_progress") {
        workOrder.completedAt = undefined;
        workOrder.invoicedAt = undefined;
        workOrder.cancelledAt = undefined;
        workOrder.closedAt = undefined;
      }
    }
  }

  // If odometerOut exists and serviceOdometer missing, set it
  if (!workOrder.serviceOdometer) {
    workOrder.serviceOdometer =
      workOrder.odometerOut ?? workOrder.odometerIn ?? workOrder.odometer ?? undefined;
  }

  return workOrder;
}
