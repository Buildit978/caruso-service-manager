// src/routes/workOrders.routes.ts
import { Types } from 'mongoose';
import { Router, Request, Response, NextFunction } from 'express';
import { WorkOrder } from '../models/workOrder.model';
import { Customer } from '../models/customer.model';
import { attachAccountId } from '../middleware/account.middleware';
import { applyWorkOrderLifecycle } from "../utils/workOrderLifecycle";

const router = Router();

router.use(attachAccountId);


        async function writeBackVehicleOdometer(opts: {
          accountId: any;
          customerId: any;
          vehicleId: any;
          odometer: number;
        }) {
          const { accountId, customerId, vehicleId, odometer } = opts;
          if (!vehicleId || !Number.isFinite(odometer) || odometer < 0) return;

          // Update embedded vehicle in Customer. This creates the field if it doesn't exist.
          await Customer.updateOne(
            { _id: customerId, accountId, "vehicles._id": vehicleId },
            {
              $set: {
                "vehicles.$.odometer": Math.round(odometer),
                "vehicles.$.odometerUpdatedAt": new Date(),
              },
            }
          );
        }




// GET /api/work-orders/summary
router.get("/summary", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = req.accountId;
    if (!accountId) {
      return res.status(400).json({ message: "Missing accountId" });
    }

    const { status, customerId, from, to } = req.query as {
      status?: string;
      customerId?: string;
      from?: string;
      to?: string;
    };

    // 🔹 Base match scoped by account
    const match: any = { accountId };

    // ✅ Status filter
    if (status && status.trim() !== "") {
      const normalized = status.trim().toLowerCase().replace(/\s+/g, "_");

      if (normalized === "active") {
        match.status = { $in: ["open", "in_progress"] };
      } else {
        match.status = normalized;
      }
    }

    if (customerId && customerId.trim() !== "") {
      match.customerId = customerId.trim();
    }

    // ✅ Date range (openedAt preferred, date fallback)
    if ((from && from.trim() !== "") || (to && to.trim() !== "")) {
      const range: any = {};

      if (from && from.trim() !== "") {
        const d = new Date(from);
        if (!isNaN(d.getTime())) range.$gte = d;
      }

      if (to && to.trim() !== "") {
        const d = new Date(to);
        if (!isNaN(d.getTime())) range.$lte = d;
      }

      if (Object.keys(range).length) {
        match.$or = [{ openedAt: range }, { date: range }];
      }
    }

    // 🔹 Aggregate counts by status
    const result = await WorkOrder.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // 🔹 Fixed summary shape
    const summary: Record<string, number> = {
      open: 0,
      in_progress: 0,
      completed: 0,
      invoiced: 0,
      cancelled: 0,
    };

    for (const row of result as any[]) {
      const key = String(row?._id ?? "").toLowerCase();
      if (key in summary && typeof row.count === "number") {
        summary[key] = row.count;
      }
    }

    // ✅ Derived field (not stored)
    (summary as any).active = summary.open + summary.in_progress;

    res.json(summary);
  } catch (err) {
    next(err);
  }
});




 // GET /api/work-orders?status=&customerId=&vehicleId=&from=&to=&search=
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = req.accountId;
    if (!accountId) return res.status(400).json({ message: "Missing accountId" });

    const {
      status,
      customerId,
      vehicleId,
      from,
      to,
      search,
    } = req.query as {
      status?: string;
      customerId?: string;
      vehicleId?: string;
      from?: string;
      to?: string;
      search?: string;
    };

    // Base scoped match
    const match: any = { accountId };

    // Optional filters
    if (customerId) match.customerId = customerId;
    if (vehicleId) match.vehicleId = vehicleId;

    // Date range (assuming createdAt or serviceDate; keep whichever your list uses)
    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = new Date(from);
      if (to) match.createdAt.$lte = new Date(to);
    }

    // Normalize status query
    const normalizedStatus = (status || "").trim().toLowerCase();

    if (normalizedStatus) {
      if (normalizedStatus === "active") {
        // ✅ Active = not in a final state
        match.status = { $nin: ["completed", "complete", "invoiced", "cancelled", "canceled"] };
      } else if (normalizedStatus === "completed") {
        // treat "complete" + "completed" the same
        match.status = { $in: ["completed", "complete"] };
      } else {
        // normal single-status filter
        match.status = normalizedStatus;
      }
    }

    // Optional search (only if you already support it — example below)
    if (search && search.trim()) {
      const s = search.trim();
      match.$or = [
        { complaint: new RegExp(s, "i") },
        { notes: new RegExp(s, "i") },
        { workOrderNumber: new RegExp(s, "i") }, // if you have it
      ];
    }

    const workOrders = await WorkOrder.find(match)
        .sort({ createdAt: -1 })
        .populate("customerId", "fullName name firstName lastName") // ✅ add this
        .lean();

      res.json(workOrders);

    return res.json(workOrders);
  } catch (err) {
    next(err);
  }
});



// GET /api/work-orders/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const accountId = req.accountId;
    if (!accountId) {
      return res.status(400).json({ message: 'Missing accountId' });
    }

    const { id } = req.params;

    console.log('[workOrders GET/:id] accountId:', accountId.toString());
    console.log('[workOrders GET/:id] id param:', id);

    // 🔒 Guard: id must be a valid ObjectId
    if (!Types.ObjectId.isValid(id)) {
      console.warn('[workOrders GET/:id] Invalid ObjectId param received:', id);
      return res.status(400).json({ message: 'Invalid work order id' });
    }

    const workOrder = await WorkOrder.findOne({
      _id: id,
      accountId,
    })
      .populate(
        'customerId',
        'firstName lastName phone email address vehicles' // include vehicles for lookup
      );

    if (!workOrder) {
      return res.status(404).json({ message: 'Work order not found' });
    }

    // Ensure vehicle snapshot is present in the response. If missing but a vehicleId exists,
    // try to hydrate from the customer's saved vehicles.
    const woObj: any = workOrder.toObject();

    const customer: any = woObj.customerId;
    const hasVehicleSnapshot = Boolean(woObj.vehicle);
    const vehicleId = woObj.vehicle?.vehicleId || woObj.vehicleId;

    if (!hasVehicleSnapshot && customer?.vehicles?.length && vehicleId) {
      const match = customer.vehicles.find(
        (v: any) => v._id?.toString() === vehicleId.toString()
      );
      if (match) {
        woObj.vehicle = {
          vehicleId: match._id,
          year: match.year,
          make: match.make,
          model: match.model,
          vin: match.vin,
          licensePlate: match.licensePlate,
          color: match.color,
          notes: match.notes,
        };
      }
    }

    // Normalize line items + money fields so older work orders (without the new schema)
    // still return a consistent shape to the frontend.
    const rawLineItems: any[] = Array.isArray(woObj.lineItems)
      ? woObj.lineItems
      : [];
    const normalizedLineItems = rawLineItems.map((item) => {
      const quantity = Number(item?.quantity) || 0;
      const unitPrice = Number(item?.unitPrice) || 0;
      const lineTotal =
        typeof item?.lineTotal === 'number'
          ? item.lineTotal
          : quantity * unitPrice;
      return {
        type: item?.type,
        description: item?.description ?? '',
        quantity,
        unitPrice,
        lineTotal,
      };
    });

    const subtotal =
      typeof woObj.subtotal === 'number'
        ? woObj.subtotal
        : normalizedLineItems.reduce(
            (sum: number, item: any) => sum + (item.lineTotal || 0),
            0
          );

    const taxRate =
      typeof woObj.taxRate === 'number' && !Number.isNaN(woObj.taxRate)
        ? woObj.taxRate
        : 13;
    const taxAmount =
      typeof woObj.taxAmount === 'number'
        ? woObj.taxAmount
        : subtotal * (taxRate / 100);
    const total =
      typeof woObj.total === 'number' ? woObj.total : subtotal + taxAmount;

    woObj.lineItems = normalizedLineItems;
    woObj.taxRate = taxRate;
    woObj.subtotal = subtotal;
    woObj.taxAmount = taxAmount;
    woObj.total = total;

    res.json(woObj);
  } catch (error) {
    console.error('Error fetching work order by ID:', error);
    res.status(500).json({ message: 'Server error' });
  }
});




// POST /api/work-orders
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = req.accountId;
    if (!accountId) return res.status(400).json({ message: "Missing accountId" });

    const { customerId, complaint, diagnosis, notes, vehicle } = req.body ?? {};

    if (!customerId) return res.status(400).json({ message: "customerId is required" });
    if (!complaint || String(complaint).trim() === "") {
      return res.status(400).json({ message: "complaint is required" });
    }

    // Ensure customer exists + scoped by account (important)
    const customer = await Customer.findOne({ _id: customerId, accountId }).lean();
    if (!customer) return res.status(400).json({ message: "Invalid customerId" });

    // --- ODO DEFAULTING (odometerIn) ---
    const bodyOdoIn = req.body?.odometerIn;
    const bodyOdoLegacy = req.body?.odometer;

    let odometerIn: number | undefined = undefined;

    // 1) If frontend explicitly sent odometerIn, prefer it
    if (bodyOdoIn !== undefined && bodyOdoIn !== null && bodyOdoIn !== "") {
      const n = Number(String(bodyOdoIn).replace(/,/g, "").trim());
      if (Number.isFinite(n) && n >= 0) odometerIn = Math.round(n);
    }

    // 2) else if legacy odometer was sent, treat as odometerIn
    if (odometerIn === undefined && bodyOdoLegacy !== undefined && bodyOdoLegacy !== null && bodyOdoLegacy !== "") {
      const n = Number(String(bodyOdoLegacy).replace(/,/g, "").trim());
      if (Number.isFinite(n) && n >= 0) odometerIn = Math.round(n);
    }

    // 3) else try snapshot vehicle.odometer (if you ever add it)
    if (odometerIn === undefined && vehicle?.odometer !== undefined) {
      const n = Number(String(vehicle.odometer).replace(/,/g, "").trim());
      if (Number.isFinite(n) && n >= 0) odometerIn = Math.round(n);
    }

    // 4) else try customer embedded vehicle match by vehicle.vehicleId
    if (odometerIn === undefined && vehicle?.vehicleId && Array.isArray((customer as any).vehicles)) {
      const vId = String(vehicle.vehicleId);
      const match = (customer as any).vehicles.find((v: any) => String(v?._id) === vId);
      const candidate = match?.odometer ?? match?.lastOdometer ?? match?.mileage; // tolerate different field names
      if (candidate !== undefined && candidate !== null && candidate !== "") {
        const n = Number(String(candidate).replace(/,/g, "").trim());
        if (Number.isFinite(n) && n >= 0) odometerIn = Math.round(n);
      }
    }

    const workOrder = new WorkOrder({
      accountId,
      customerId,
      complaint: String(complaint).trim(),
      diagnosis,
      notes,
      vehicle,
      status: "open",
      date: new Date(),

      // new lifecycle fields (safe even if undefined)
      odometerIn,
      // keep legacy field aligned too
      odometer: odometerIn,
    });

    // lifecycle normalization (status + odometers + timestamps)
    applyWorkOrderLifecycle(workOrder, {
      status: workOrder.status,
      odometer: workOrder.odometer,
      odometerIn: workOrder.odometerIn,
      odometerOut: req.body?.odometerOut,
    });

    await workOrder.save();
    res.status(201).json(workOrder);
  } catch (err) {
    next(err);
  }
});



// PUT /api/work-orders/:id
router.put(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = req.accountId;
      if (!accountId) {
        return res.status(400).json({ message: "Missing accountId" });
      }

      const { id } = req.params;
      const updates = req.body;

      // 1) Load the existing work order scoped by account
      const workOrder = await WorkOrder.findOne({ _id: id, accountId });
      if (!workOrder) {
        return res.status(404).json({ message: "Work order not found" });
      }

      // 2) Apply scalar field updates if provided
      if (typeof updates.complaint !== "undefined") {
        workOrder.complaint = updates.complaint;
      }
      if (typeof updates.diagnosis !== "undefined") {
        workOrder.diagnosis = updates.diagnosis;
      }
      if (typeof updates.notes !== "undefined") {
        workOrder.notes = updates.notes;
      }
      if (typeof updates.odometer !== "undefined") {
        workOrder.odometer = updates.odometer;
      }
      if (typeof updates.status !== "undefined") {
        workOrder.status = updates.status;
      }

      // 3) Vehicle snapshot (optional)
      if (typeof updates.vehicle !== "undefined" && updates.vehicle) {
        const v = updates.vehicle;
        workOrder.vehicle = {
          vehicleId: v.vehicleId,
          year: v.year,
          make: v.make,
          model: v.model,
          vin: v.vin,
          licensePlate: v.licensePlate,
          color: v.color,
          notes: v.notes,
        };
      }

      // 4) Line items + taxRate from the frontend
      if (Array.isArray(updates.lineItems)) {
        workOrder.lineItems = updates.lineItems;
      }
      if (typeof updates.taxRate !== "undefined") {
        workOrder.taxRate = updates.taxRate;
      }

      // 5) If lineItems or taxRate changed, recalc money fields
      if (
        Array.isArray(updates.lineItems) ||
        typeof updates.taxRate !== "undefined"
      ) {
        const items = workOrder.lineItems || [];
        const taxRate = workOrder.taxRate ?? 13;

        const subtotal = items.reduce(
          (sum: number, item: any) => sum + (item.lineTotal || 0),
          0
        );
        const taxAmount = subtotal * (taxRate / 100);
        const total = subtotal + taxAmount;

        (workOrder as any).subtotal = subtotal;
        (workOrder as any).taxAmount = taxAmount;
        (workOrder as any).total = total;
      }

      // 6) Save and return the full work order
      const saved = await workOrder.save();
      res.json(saved);
    } catch (err) {
      next(err);
    }
  }
);


/**
 * PATCH /api/work-orders/:id
 * Safe patch: whitelist + run hooks via save()
 */
// PATCH /api/work-orders/:id
// Safe patch: whitelist + lifecycle + totals recalculation + runs schema hooks via save()
router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = req.accountId;
    if (!accountId) return res.status(400).json({ message: "Missing accountId" });

    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid work order id" });
    }

    const workOrder = await WorkOrder.findOne({ _id: id, accountId });
    if (!workOrder) return res.status(404).json({ message: "Work order not found" });

    const patch: any = req.body ?? {}; // ✅ keep this as any so TS doesn't block fields

    // capture status BEFORE changes (for transition detection)
    const prevStatus = workOrder.status;

    // ----------------------------
    // 1) Simple text fields
    // ----------------------------
    if (patch.complaint !== undefined) workOrder.complaint = String(patch.complaint ?? "");
    if (patch.diagnosis !== undefined) workOrder.diagnosis = String(patch.diagnosis ?? "");
    if (patch.notes !== undefined) workOrder.notes = String(patch.notes ?? "");

    // ----------------------------
    // 2) Vehicle snapshot
    // ----------------------------
    if (patch.vehicle !== undefined) {
      workOrder.vehicle = patch.vehicle;
    }

    // ----------------------------
    // 3) Line items + tax rate + totals (optional but nice)
    // ----------------------------
    const lineItemsChanged = patch.lineItems !== undefined;
    const taxRateChanged = patch.taxRate !== undefined;

    if (lineItemsChanged) {
      if (!Array.isArray(patch.lineItems)) {
        return res.status(400).json({ message: "lineItems must be an array" });
      }

      workOrder.lineItems = patch.lineItems.map((item: any) => {
        const quantity = Number(item?.quantity) || 0;
        const unitPrice = Number(item?.unitPrice) || 0;
        const lineTotal =
          typeof item?.lineTotal === "number" ? item.lineTotal : quantity * unitPrice;

        return {
          type: item?.type,
          description: item?.description ?? "",
          quantity,
          unitPrice,
          lineTotal,
        };
      });
    }

    if (taxRateChanged) {
      const tr = Number(patch.taxRate);
      if (!Number.isFinite(tr) || tr < 0) {
        return res.status(400).json({ message: "taxRate must be a valid number >= 0" });
      }
      workOrder.taxRate = tr;
    }

    if (lineItemsChanged || taxRateChanged) {
      const items = Array.isArray(workOrder.lineItems) ? workOrder.lineItems : [];
      const subtotal = items.reduce(
        (sum: number, item: any) => sum + (Number(item?.lineTotal) || 0),
        0
      );

      const taxRate = Number(workOrder.taxRate ?? 13);
      const taxAmount = subtotal * (taxRate / 100);
      const total = subtotal + taxAmount;

      (workOrder as any).subtotal = subtotal;
      (workOrder as any).taxAmount = taxAmount;
      (workOrder as any).total = total;
    }

    // ----------------------------
    // 4) Lifecycle + odo logic (this is the key call)
    // ----------------------------
    applyWorkOrderLifecycle(workOrder, {
      status: patch.status,
      odometer: patch.odometer, // legacy support
      odometerIn: patch.odometerIn,
      odometerOut: patch.odometerOut,
      serviceOdometer: patch.serviceOdometer,
    });

    await workOrder.save();

    const nextStatus = workOrder.status;

    // ----------------------------
    // 5) Write-back mileage when completing/invoicing
    // ----------------------------
    if (
      (nextStatus === "completed" || nextStatus === "invoiced") &&
      prevStatus !== nextStatus
    ) {
      const vehicleId = (workOrder as any)?.vehicle?.vehicleId;

      const mileage =
        (workOrder as any)?.odometerOut ??
        (workOrder as any)?.serviceOdometer ??
        (workOrder as any)?.odometerIn ??
        (workOrder as any)?.odometer;

      if (vehicleId && typeof mileage === "number") {
        await writeBackVehicleOdometer({
          accountId,
          customerId: workOrder.customerId,
          vehicleId,
          odometer: mileage,
        });
      }
    }

    res.json(workOrder);
  } catch (err: any) {
    // If odo rule throws, return 400 instead of 500
    if (err instanceof Error && err.message.includes("odometerOut")) {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
});


/**
 * PATCH /api/work-orders/:id/status
 * Quick status update, but still uses the same lifecycle logic.
 */
router.patch("/:id/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = req.accountId;
    if (!accountId) return res.status(400).json({ message: "Missing accountId" });

    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid work order id" });
    }

    const { status } = req.body ?? {};
    if (!status) return res.status(400).json({ message: "status is required" });

    

    const nextStatus = (req.body.status || "").trim().toLowerCase();

      // your usual fetch of the work order scoped by accountId
      const workOrder = await WorkOrder.findOne({ _id: id, accountId });
      if (!workOrder) return res.status(404).json({ message: "Work order not found" });

      // normalize + assign
      workOrder.status = nextStatus as any;

      // ✅ stamp lifecycle times (server is the source of truth)
      const now = new Date();

      if (nextStatus === "in_progress") {
        // only set the first time work starts
        if (!workOrder.startedAt) workOrder.startedAt = now;
        // optional: clear hold marker when resuming
        // workOrder.onHoldAt = undefined;
      }

      if (nextStatus === "on_hold" ) {
        if (!workOrder.onHoldAt) workOrder.onHoldAt = now;
      }

      if (nextStatus === "completed" || nextStatus === "complete") {
        if (!workOrder.completedAt) workOrder.completedAt = now;
      }

      if (nextStatus === "invoiced") {
        if (!workOrder.invoicedAt) workOrder.invoicedAt = now;
      }

      await workOrder.save();

      return res.json(workOrder);


          applyWorkOrderLifecycle(workOrder, { status });

          await workOrder.save(); // ✅ hooks + normalization
          res.json(workOrder);
        } catch (err) {
          next(err);
        }
      });


router.delete(
    "/:id",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const accountId = req.accountId;
            if (!accountId) {
                return res.status(400).json({ message: "Missing accountId" });
            }

            const { id } = req.params;
            const deleted = await WorkOrder.findOneAndDelete({
                _id: id,
                accountId,
            });

            if (!deleted) {
                return res.status(404).json({ message: "Work order not found" });
            }

            return res.status(204).send();
        } catch (err) {
            next(err);
        }
    }
);



export default router;
