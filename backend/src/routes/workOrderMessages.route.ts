// backend/src/routes/workOrderMessages.route.ts
import { Router, Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { WorkOrder } from "../models/workOrder.model";
import { WorkOrderMessageModel } from "../models/workOrderMessage.model";
import { User } from "../models/user.model";
import { requireBillingActive } from "../middleware/requireBillingActive";

const router = Router({ mergeParams: true });

// Helper: keep your access logic consistent.
// If you already have a util like assertWorkOrderAccess(...) use that instead.
async function loadWorkOrderOr404(accountId: any, workOrderId: string) {
  if (!Types.ObjectId.isValid(workOrderId)) return null;
  return WorkOrder.findOne({ _id: workOrderId, accountId });
}

function getActorNameSnapshot(req: any) {
  return (
    req.actor?.name ||
    req.actor?.fullName ||
    req.actor?.email ||
    "Unknown User"
  );
}

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
   const accountId = (req as any).accountId;
   const actor = (req as any).actor;

    if (!accountId || !actor?._id || !actor?.role) {
    return res.status(401).json({ message: "Unauthorized" });
    }


    const workOrderId = req.params.id;
    const wo = await loadWorkOrderOr404(accountId, workOrderId);
    if (!wo) return res.status(404).json({ message: "Work order not found" });

    // If you have technician scoping to assigned WOs, enforce it here.
    // Minimal version: if actor can fetch WO detail today, allow this too.

    // Technicians only see internal messages
    const isTech = actor.role === "technician";
    const query: any = {
      accountId,
      workOrderId: wo._id,
    };

    if (isTech) {
      query.visibility = "internal";
    }

    let items = await WorkOrderMessageModel.find(query)
      .sort({ createdAt: 1 }) // chronological read
      .lean();

    // Best-effort: resolve "Unknown User" for existing messages missing author snapshot
    const needsResolve = items.filter(
      (m: any) => !m.actor?.nameSnapshot || m.actor.nameSnapshot === "Unknown User"
    );
    if (needsResolve.length > 0) {
      const authorIds = [...new Set(needsResolve.map((m: any) => String(m.actor?.id)).filter(Boolean))];
      const users = await User.find({ _id: { $in: authorIds.map((id: string) => new Types.ObjectId(id)) } })
        .select("_id name firstName lastName email")
        .lean();
      const nameByUserId: Record<string, string> = {};
      for (const u of users) {
        const id = String((u as any)._id);
        const displayName =
          (u as any).name ||
          [(u as any).firstName, (u as any).lastName].filter(Boolean).join(" ").trim() ||
          (u as any).email ||
          "Unknown User";
        nameByUserId[id] = displayName;
      }
      items = items.map((m: any) => {
        if (!m.actor?.nameSnapshot || m.actor.nameSnapshot === "Unknown User") {
          const resolved = nameByUserId[String(m.actor?.id)];
          if (resolved) {
            return { ...m, actor: { ...m.actor, nameSnapshot: resolved } };
          }
        }
        return m;
      });
    }

    return res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireBillingActive, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = (req as any).accountId;
    const actor = (req as any).actor;

    if (!accountId || !actor?._id || !actor?.role) {
    return res.status(401).json({ message: "Unauthorized" });
    }


    const workOrderId = req.params.id;
    const wo = await loadWorkOrderOr404(accountId, workOrderId);
    if (!wo) return res.status(404).json({ message: "Work order not found" });

    const rawBody = String(req.body?.body ?? "").trim();
    if (!rawBody) return res.status(400).json({ message: "body is required" });
    if (rawBody.length > 2000)
      return res.status(400).json({ message: "body too long (max 2000)" });

    // Technicians are forced to internal only
    const isTech = actor.role === "technician";
    const requestedVisibility = req.body?.visibility || req.body?.channel || "internal";
    const visibility = isTech ? "internal" : (requestedVisibility === "customer" ? "customer" : "internal");
    const channel = visibility; // keep channel for backward compat

    const doc = await WorkOrderMessageModel.create({
      accountId,
      workOrderId: wo._id,
      channel,
      visibility,
      body: rawBody,
      actor: {
        id: actor._id,
        nameSnapshot: getActorNameSnapshot(req),
        roleSnapshot: actor.role,
      },
      meta: {
        ip: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip,
        userAgent: String(req.headers["user-agent"] || ""),
      },
    });

    return res.status(201).json({ item: doc });
  } catch (err) {
    next(err);
  }
});

export default router;
