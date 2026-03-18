// backend/src/routes/scheduler.route.ts
import { Types } from "mongoose";
import { Router, Request, Response, NextFunction } from "express";
import { ScheduleEntry } from "../models/scheduleEntry.model";
import { WorkOrder } from "../models/workOrder.model";
import { User } from "../models/user.model";
import { requireRole } from "../middleware/requireRole";
import { requireActiveBilling } from "../middleware/requireBillingActive";

const router = Router();

const MIN_DURATION_MINUTES = 15;
const DEFAULT_UNSCHEDULED_LIMIT = 50;

/** Format date as YYYY-MM-DD */
function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Set start of day UTC for scheduledDate */
function toScheduledDate(startAt: Date): Date {
  const d = new Date(startAt);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Compute endAt from startAt + durationMinutes */
function computeEndAt(startAt: Date, durationMinutes: number): Date {
  const end = new Date(startAt);
  end.setMinutes(end.getMinutes() + durationMinutes);
  return end;
}

/** Detect overlapping entries for same technician within account (status=scheduled) */
async function detectOverlaps(
  accountId: Types.ObjectId,
  startAt: Date,
  endAt: Date,
  technicianId: Types.ObjectId | null | undefined,
  excludeId?: Types.ObjectId
): Promise<{ message: string; entryId: string }[]> {
  if (!technicianId) return [];

  const q: Record<string, unknown> = {
    accountId,
    status: "scheduled",
    technicianId,
    startAt: { $lt: endAt },
    endAt: { $gt: startAt },
  };
  if (excludeId) {
    q._id = { $ne: excludeId };
  }

  const overlaps = await ScheduleEntry.find(q)
    .select("_id startAt endAt")
    .lean();

  return overlaps.map((o) => ({
    message: `Overlaps with existing entry ${formatTime(o.startAt)}–${formatTime(o.endAt)}`,
    entryId: String(o._id),
  }));
}

function formatTime(d: Date): string {
  return new Date(d).toISOString().slice(11, 16);
}

/** Extract ObjectId from ref (handles populated object or raw id) */
function toObjectId(val: unknown): Types.ObjectId | null {
  if (!val) return null;
  if (val instanceof Types.ObjectId) return val;
  if (typeof val === "object" && val && "_id" in val) return (val as { _id: Types.ObjectId })._id as Types.ObjectId;
  if (Types.ObjectId.isValid(String(val))) return new Types.ObjectId(String(val));
  return null;
}

/** Build calendar-ready payload with work order, customer, vehicle, technician labels */
async function enrichPayload(
  entries: Record<string, unknown>[],
  accountId: Types.ObjectId
): Promise<Record<string, unknown>[]> {
  const workOrderIds = entries.map((e) => toObjectId(e.workOrderId)).filter(Boolean) as Types.ObjectId[];
  const technicianIds = entries.map((e) => toObjectId(e.technicianId)).filter(Boolean) as Types.ObjectId[];

  const [workOrders, technicians] = await Promise.all([
    WorkOrder.find({ _id: { $in: workOrderIds }, accountId })
      .populate("customerId", "firstName lastName fullName")
      .lean(),
    technicianIds.length
      ? User.find({ _id: { $in: technicianIds }, accountId })
          .select("name displayName firstName lastName email")
          .lean()
      : [],
  ]);

  const woMap = new Map<string, Record<string, unknown>>();
  for (const wo of workOrders as Record<string, unknown>[]) {
    woMap.set(String(wo._id), wo);
  }
  const techMap = new Map<string, Record<string, unknown>>();
  for (const t of technicians as Record<string, unknown>[]) {
    techMap.set(String(t._id), t);
  }

  return entries.map((e) => {
    const woId = toObjectId(e.workOrderId);
    const techId = toObjectId(e.technicianId);
    const wo = woId ? woMap.get(String(woId)) : undefined;
    const tech = techId ? techMap.get(String(techId)) : null;

    const customer = wo?.customerId && typeof wo.customerId === "object"
      ? (wo.customerId as Record<string, unknown>)
      : undefined;
    const customerLabel = customer
      ? String(
          (customer as Record<string, unknown>).fullName ||
            `${(customer as Record<string, unknown>).firstName ?? ""} ${(customer as Record<string, unknown>).lastName ?? ""}`.trim() ||
            "(No name)"
        )
      : undefined;

    const vehicle = wo?.vehicle && typeof wo.vehicle === "object"
      ? (wo.vehicle as Record<string, unknown>)
      : undefined;
    const vehicleLabel = vehicle
      ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || undefined
      : undefined;

    const technicianLabel = tech
      ? String(
          (tech as Record<string, unknown>).displayName ||
            (tech as Record<string, unknown>).name ||
            `${(tech as Record<string, unknown>).firstName ?? ""} ${(tech as Record<string, unknown>).lastName ?? ""}`.trim() ||
            (tech as Record<string, unknown>).email ||
            "Unknown"
        )
      : undefined;

    return {
      ...e,
      workOrder: wo
        ? {
            _id: wo._id,
            status: wo.status,
            complaint: wo.complaint,
            customerLabel,
            vehicleLabel,
          }
        : undefined,
      technicianLabel,
    };
  });
}

// =============================================================================
// GET /api/scheduler
// =============================================================================
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = req.accountId;
    if (!accountId) return res.status(400).json({ message: "Missing accountId" });

    const startStr = typeof req.query.start === "string" ? req.query.start : "";
    const endStr = typeof req.query.end === "string" ? req.query.end : "";
    const technicianIdParam = typeof req.query.technicianId === "string" ? req.query.technicianId : "";

    if (!startStr || !endStr) {
      return res.status(400).json({ message: "start and end query params are required (YYYY-MM-DD)" });
    }

    const rangeStart = new Date(startStr);
    rangeStart.setUTCHours(0, 0, 0, 0);
    const rangeEnd = new Date(endStr);
    rangeEnd.setUTCHours(23, 59, 59, 999);
    if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
      return res.status(400).json({ message: "Invalid start or end date format" });
    }

    const q: Record<string, unknown> = {
      accountId,
      status: "scheduled",
      startAt: { $lt: rangeEnd },
      endAt: { $gt: rangeStart },
    };

    if (technicianIdParam && Types.ObjectId.isValid(technicianIdParam)) {
      q.technicianId = new Types.ObjectId(technicianIdParam);
    }

    const entries = await ScheduleEntry.find(q)
      .sort({ startAt: 1 })
      .populate("workOrderId", "status complaint vehicle customerId")
      .lean();

    const raw = entries.map((e: Record<string, unknown>) => ({
      ...e,
      scheduledDate: e.scheduledDate ? toDateString(new Date(e.scheduledDate as Date)) : undefined,
    }));

    const enriched = await enrichPayload(raw, accountId);

    return res.json(enriched);
  } catch (err) {
    next(err);
  }
});

// =============================================================================
// GET /api/scheduler/unscheduled-work-orders
// =============================================================================
router.get("/unscheduled-work-orders", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = req.accountId;
    if (!accountId) return res.status(400).json({ message: "Missing accountId" });

    const searchParam = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const limitParam = typeof req.query.limit === "string" ? req.query.limit : "";
    const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10)) || DEFAULT_UNSCHEDULED_LIMIT) : DEFAULT_UNSCHEDULED_LIMIT;

    const scheduledWorkOrderIds = await ScheduleEntry.find({
      accountId,
      status: "scheduled",
    })
      .distinct("workOrderId");

    const q: Record<string, unknown> = {
      accountId,
      _id: { $nin: scheduledWorkOrderIds },
      status: { $in: ["open", "in_progress", "on_hold"] },
    };

    if (searchParam) {
      q.$or = [
        { complaint: { $regex: searchParam, $options: "i" } },
        { diagnosis: { $regex: searchParam, $options: "i" } },
        { notes: { $regex: searchParam, $options: "i" } },
      ];
    }

    const workOrders = await WorkOrder.find(q)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("customerId", "firstName lastName fullName")
      .lean();

    const withLabels = workOrders.map((wo: Record<string, unknown>) => {
      const customer = wo.customerId && typeof wo.customerId === "object"
        ? (wo.customerId as Record<string, unknown>)
        : undefined;
      const customerLabel = customer
        ? String(
            customer.fullName ||
              `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() ||
              "(No name)"
          )
        : undefined;
      const vehicle = wo.vehicle && typeof wo.vehicle === "object"
        ? (wo.vehicle as Record<string, unknown>)
        : undefined;
      const vehicleLabel = vehicle
        ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || undefined
        : undefined;
      return {
        ...wo,
        customerLabel,
        vehicleLabel,
      };
    });

    return res.json(withLabels);
  } catch (err) {
    next(err);
  }
});

// =============================================================================
// GET /api/scheduler/work-order/:workOrderId
// =============================================================================
router.get("/work-order/:workOrderId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = req.accountId;
    if (!accountId) return res.status(400).json({ message: "Missing accountId" });

    const { workOrderId } = req.params;
    if (!Types.ObjectId.isValid(workOrderId)) {
      return res.status(400).json({ message: "Invalid workOrderId" });
    }

    const entry = await ScheduleEntry.findOne({
      accountId,
      workOrderId: new Types.ObjectId(workOrderId),
      status: "scheduled",
    })
      .populate("workOrderId", "status complaint vehicle customerId")
      .populate("technicianId", "name displayName firstName lastName email")
      .lean();

    if (!entry) {
      return res.status(404).json({ message: "No scheduled entry found for this work order" });
    }

    const raw = {
      ...entry,
      scheduledDate: entry.scheduledDate ? toDateString(new Date(entry.scheduledDate)) : undefined,
    };
    const [enriched] = await enrichPayload([raw], accountId);
    return res.json(enriched);
  } catch (err) {
    next(err);
  }
});

// =============================================================================
// POST /api/scheduler
// =============================================================================
router.post(
  "/",
  requireActiveBilling,
  requireRole(["owner", "manager"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = req.accountId;
      const actorId = req.actor?._id;
      if (!accountId) return res.status(400).json({ message: "Missing accountId" });

      const { workOrderId, startAt, durationMinutes, technicianId, notes } = req.body ?? {};

      if (!workOrderId || !Types.ObjectId.isValid(workOrderId)) {
        return res.status(400).json({ message: "workOrderId is required and must be valid" });
      }
      if (!durationMinutes || typeof durationMinutes !== "number") {
        return res.status(400).json({ message: "durationMinutes is required" });
      }
      if (durationMinutes < MIN_DURATION_MINUTES) {
        return res.status(400).json({
          message: `durationMinutes must be at least ${MIN_DURATION_MINUTES}`,
        });
      }

      const startAtDate = startAt ? new Date(startAt) : null;
      if (!startAtDate || Number.isNaN(startAtDate.getTime())) {
        return res.status(400).json({ message: "startAt is required and must be a valid date" });
      }

      const workOrder = await WorkOrder.findOne({
        _id: workOrderId,
        accountId,
      }).lean();
      if (!workOrder) {
        return res.status(400).json({ message: "Work order not found or does not belong to account" });
      }

      if (technicianId && Types.ObjectId.isValid(technicianId)) {
        const technician = await User.findOne({
          _id: technicianId,
          accountId,
          isActive: true,
        }).lean();
        if (!technician) {
          return res.status(400).json({ message: "Technician not found or does not belong to account" });
        }
      }

      const existingActive = await ScheduleEntry.findOne({
        accountId,
        workOrderId: new Types.ObjectId(workOrderId),
        status: "scheduled",
      });
      if (existingActive) {
        return res.status(409).json({
          message: "Work order already has an active schedule entry",
          existingId: String(existingActive._id),
        });
      }

      const endAtDate = computeEndAt(startAtDate, durationMinutes);
      const scheduledDate = toScheduledDate(startAtDate);

      const entry = new ScheduleEntry({
        accountId,
        workOrderId: new Types.ObjectId(workOrderId),
        scheduledDate,
        startAt: startAtDate,
        endAt: endAtDate,
        durationMinutes,
        technicianId: technicianId && Types.ObjectId.isValid(technicianId) ? new Types.ObjectId(technicianId) : null,
        status: "scheduled",
        notes: notes ? String(notes).trim() : undefined,
        createdBy: actorId ?? null,
        updatedBy: actorId ?? null,
      });

      await entry.save();

      const warnings = await detectOverlaps(
        accountId,
        startAtDate,
        endAtDate,
        entry.technicianId ?? null,
        undefined
      );

      const doc = entry.toObject ? entry.toObject() : (entry as unknown as Record<string, unknown>);
      const payload = {
        ...doc,
        scheduledDate: toDateString(scheduledDate),
        warnings,
      };

      return res.status(201).json(payload);
    } catch (err) {
      next(err);
    }
  }
);

// =============================================================================
// PATCH /api/scheduler/:id
// =============================================================================
router.patch(
  "/:id",
  requireActiveBilling,
  requireRole(["owner", "manager"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = req.accountId;
      const actorId = req.actor?._id;
      if (!accountId) return res.status(400).json({ message: "Missing accountId" });

      const { id } = req.params;
      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid schedule entry id" });
      }

      const entry = await ScheduleEntry.findOne({ _id: id, accountId });
      if (!entry) {
        return res.status(404).json({ message: "Schedule entry not found" });
      }

      const { startAt, durationMinutes, technicianId, notes, status } = req.body ?? {};

      let startAtDate = entry.startAt;
      let duration = entry.durationMinutes;
      let technicianIdVal: Types.ObjectId | null = entry.technicianId ?? null;

      if (typeof startAt !== "undefined") {
        const parsed = new Date(startAt);
        if (Number.isNaN(parsed.getTime())) {
          return res.status(400).json({ message: "startAt must be a valid date" });
        }
        startAtDate = parsed;
      }
      if (typeof durationMinutes !== "undefined") {
        if (typeof durationMinutes !== "number" || durationMinutes < MIN_DURATION_MINUTES) {
          return res.status(400).json({
            message: `durationMinutes must be at least ${MIN_DURATION_MINUTES}`,
          });
        }
        duration = durationMinutes;
      }
      if (typeof technicianId !== "undefined") {
        if (technicianId === null || technicianId === "") {
          technicianIdVal = null;
        } else if (technicianId && Types.ObjectId.isValid(technicianId)) {
          const technician = await User.findOne({
            _id: technicianId,
            accountId,
            isActive: true,
          }).lean();
          if (!technician) {
            return res.status(400).json({ message: "Technician not found or does not belong to account" });
          }
          technicianIdVal = new Types.ObjectId(technicianId);
        } else {
          return res.status(400).json({ message: "Invalid technicianId" });
        }
      }
      if (typeof notes !== "undefined") {
        entry.notes = notes ? String(notes).trim() : undefined;
      }
      if (typeof status !== "undefined") {
        const s = String(status).toLowerCase().trim();
        if (s !== "scheduled" && s !== "cancelled") {
          return res.status(400).json({ message: "status must be 'scheduled' or 'cancelled'" });
        }
        entry.status = s as "scheduled" | "cancelled";
      }

      const endAtDate = computeEndAt(startAtDate, duration);
      const scheduledDate = toScheduledDate(startAtDate);

      entry.startAt = startAtDate;
      entry.endAt = endAtDate;
      entry.durationMinutes = duration;
      entry.scheduledDate = scheduledDate;
      entry.technicianId = technicianIdVal;
      entry.updatedBy = actorId ?? null;

      await entry.save();

      const warnings = await detectOverlaps(
        accountId,
        entry.startAt,
        entry.endAt,
        entry.technicianId ?? null,
        entry._id
      );

      const doc = entry.toObject ? entry.toObject() : (entry as unknown as Record<string, unknown>);
      return res.json({
        ...doc,
        scheduledDate: toDateString(scheduledDate),
        warnings,
      });
    } catch (err) {
      next(err);
    }
  }
);

// =============================================================================
// DELETE /api/scheduler/:id (soft delete: set status to cancelled)
// =============================================================================
router.delete(
  "/:id",
  requireActiveBilling,
  requireRole(["owner", "manager"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = req.accountId;
      const actorId = req.actor?._id;
      if (!accountId) return res.status(400).json({ message: "Missing accountId" });

      const { id } = req.params;
      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid schedule entry id" });
      }

      const entry = await ScheduleEntry.findOne({ _id: id, accountId });
      if (!entry) {
        return res.status(404).json({ message: "Schedule entry not found" });
      }

      entry.status = "cancelled";
      entry.updatedBy = actorId ?? null;
      await entry.save();

      const doc = entry.toObject ? entry.toObject() : (entry as unknown as Record<string, unknown>);
      return res.json({
        ...doc,
        scheduledDate: doc.scheduledDate ? toDateString(new Date(doc.scheduledDate as Date)) : undefined,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
