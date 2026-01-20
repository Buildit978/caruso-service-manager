// src/routes/workOrders.routes.ts
import { Types } from 'mongoose';
import { Router, Request, Response, NextFunction } from 'express';
import { WorkOrder } from '../models/workOrder.model';
import { Customer } from '../models/customer.model';
import { applyWorkOrderLifecycle } from "../utils/workOrderLifecycle";
import { computeInvoiceFinancials } from "../utils/invoiceFinancials";
import Invoice from "../models/invoice.model";
import workOrderMessagesRouter from "./workOrderMessages.route";




const router = Router();

router.use("/:id/messages", workOrderMessagesRouter);



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
router.get(
  "/summary",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = req.accountId;
      if (!accountId) return res.status(400).json({ message: "Missing accountId" });

      const base = { accountId };

      // ✅ Archive = Paid or Void ONLY (invoice truth)
      const archiveInvoiceIds = await Invoice.find({
        accountId,
        $or: [
          { status: "void" },
          {
            $expr: {
              $and: [
                { $gt: ["$total", 0] },
                { $gte: [{ $ifNull: ["$paidAmount", 0] }, "$total"] },
              ],
            },
          },
        ],
      }).distinct("_id");

      const [active, financial, archive] = await Promise.all([
        // Active
        WorkOrder.countDocuments({
          ...base,
          status: { $in: ["open", "in_progress", "on_hold"] },
        }),

        // Financial (leave as-is to avoid regressions)
        WorkOrder.countDocuments({
          ...base,
          status: { $in: ["completed", "invoiced"] },
          closedAt: { $exists: false },
        }),

        // Archive (Paid or Void ONLY)
        WorkOrder.countDocuments({
          ...base,
          invoiceId: { $in: archiveInvoiceIds },
        }),
      ]);

      const byStatus = await WorkOrder.aggregate([
        { $match: { accountId: new Types.ObjectId(accountId) } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $project: { _id: 0, status: "$_id", count: 1 } },
      ]);

      return res.json({ active, financial, archive, byStatus });
    } catch (err) {
      next(err);
    }
  }
);




// GET /api/work-orders?view=active&customerId=...&sortBy=createdAt&sortDir=desc
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = req.accountId;
    if (!accountId) return res.status(400).json({ message: "Missing accountId" });

    const isTech = req.actor?.role === "technician";

    const stripMoneyFromWorkOrder = (wo: any) => {
      const x = { ...wo };

      // WorkOrder-level money fields (remove from tech responses)
      delete x.subtotal;
      delete x.taxAmount;
      delete x.total;
      delete x.taxRate;

      // Common money-ish fields inside line items (best-effort)
      if (Array.isArray(x.lineItems)) {
        x.lineItems = x.lineItems.map((li: any) => {
          const y = { ...li };
          delete y.unitPrice;
          delete y.price;
          delete y.amount;
          delete y.cost;
          delete y.subtotal;
          delete y.tax;
          delete y.total;
          delete y.rate;
          delete y.hours;
          return y;
        });
      }

      return x;
    };


    const {
      view = "active",
      customerId,
      sortBy = "createdAt",
      sortDir = "desc",
    } = req.query as {
      view?: "active" | "financial" | "archive" | "all";
      customerId?: string;
      sortBy?: "createdAt" | "status";
      sortDir?: "asc" | "desc";
      };
    
    console.log("[GET /api/work-orders] view=%s role=%s", view, req.actor?.role);


    const q: any = { accountId };

    // Optional customer filter
    if (customerId && Types.ObjectId.isValid(customerId)) {
      q.customerId = new Types.ObjectId(customerId);
    }

    // View filters
    if (view === "active") {
      q.status = { $in: ["open", "in_progress", "on_hold"] };
      // optional: hide cancelled from active automatically
    } else if (view === "financial") {
      // 🔒 Financial view returns money-related info; technicians are blocked.
      if (isTech) {
        return res.status(403).json({ message: "Forbidden" });
      }

      q.status = { $in: ["completed", "invoiced"] };
      // TEMP: do not filter by closedAt until we confirm data shape
      q.$or = [{ closedAt: { $exists: false } }, { closedAt: null }];
    } else if (view === "archive") {
      // Archive = Paid or Void ONLY (invoice truth)
      const invoiceIds = await Invoice.find({
        accountId,
        $or: [
          // lifecycle void always archived
          { status: "void" },

          // financially paid: paidAmount >= total (and total > 0)
          {
            $expr: {
              $and: [
                { $gt: ["$total", 0] },
                { $gte: [{ $ifNull: ["$paidAmount", 0] }, "$total"] },
              ],
            },
          },
        ],
      }).distinct("_id");

      q.invoiceId = { $in: invoiceIds };
    }

    // Sorting
    const dir = sortDir === "asc" ? 1 : -1;
    const sort: any =
      sortBy === "status" ? { status: dir, createdAt: -1 } : { createdAt: dir };

    // ✅ Role-aware invoice projection:
    // - Techs get lifecycle-only (no money fields)
    // - Owner/Manager get full financial fields
    const invoiceSelect = isTech
      ? "status invoiceNumber sentAt paidAt voidedAt"
      : "status invoiceNumber sentAt paidAt voidedAt total paidAmount balanceDue payments";

    const workOrders = await WorkOrder.find(q)
      .sort(sort)
      .populate("customerId", "name fullName firstName lastName address") // optional
      .populate("invoiceId", invoiceSelect)
      .lean();

    // Normalize shape + attach authoritative financialStatus (no frontend compute)
    const normalized = workOrders.map((wo: any) => {
      const customer =
        wo.customerId && typeof wo.customerId === "object"
          ? wo.customerId
          : undefined;

      const invoiceObj =
        wo.invoiceId && typeof wo.invoiceId === "object"
          ? wo.invoiceId
          : undefined;

      let invoice = invoiceObj;

      if (invoiceObj) {
        // Only compute financials when money fields exist (owner/manager).
        // This also prevents accidental "0" computations for technicians.
        const hasMoneyFields =
          typeof (invoiceObj as any).total !== "undefined" ||
          typeof (invoiceObj as any).paidAmount !== "undefined" ||
          typeof (invoiceObj as any).balanceDue !== "undefined" ||
          Array.isArray((invoiceObj as any).payments);

        if (!isTech && hasMoneyFields) {
          const fin = computeInvoiceFinancials({
            total: Number((invoiceObj as any).total ?? 0),
            payments: Array.isArray((invoiceObj as any).payments)
              ? (invoiceObj as any).payments
              : [],
            paidAmount: Number((invoiceObj as any).paidAmount ?? 0),
            balanceDue: Number((invoiceObj as any).balanceDue ?? 0),
          } as any);

          invoice = { ...invoiceObj, ...fin };
        } else {
          // Technician: keep invoice lifecycle/status only (no financialStatus computed)
          invoice = invoiceObj;
        }
      }

      return { ...wo, customer, invoice };
    });

    // ✅ View-level post-filter (authoritative, handles legacy data)
    let result = normalized;

    if (view === "financial") {
      result = normalized.filter((wo: any) => {
        const inv = wo?.invoice;
        if (!inv) return false;

        // Void never belongs in Financial
        const lifecycle = String(inv.status || "").toLowerCase();
        if (lifecycle === "void") return false;

        // Financial = open money only
        const fs = String(inv.financialStatus || "").toLowerCase();
        return fs === "due" || fs === "partial";
      });
    }

    // ✅ IMPORTANT: return result (not raw workOrders)
   if (isTech) {
  return res.json(result.map(stripMoneyFromWorkOrder));
}

return res.json(result);

  } catch (err) {
    next(err);
  }
});




  



    // GET /api/work-orders/:id
    router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
      try {
        const accountId = req.accountId;
        if (!accountId) return res.status(400).json({ message: "Missing accountId" });

        const { id } = req.params;
        if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid id" });

        const wo = await WorkOrder.findOne({ _id: id, accountId })
          .populate("customerId", "name fullName firstName lastName phone email address ")
          .populate("invoiceId", "status invoiceNumber sentAt paidAt voidedAt lineItems subtotal taxAmount total")
          .lean();

        if (!wo) return res.status(404).json({ message: "Work order not found" });

        res.json({
          ...wo,
          customer: wo.customerId && typeof wo.customerId === "object" ? wo.customerId : undefined,
          invoice: wo.invoiceId && typeof wo.invoiceId === "object" ? wo.invoiceId : undefined,
        });
      } catch (err) {
        next(err);
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
     * Quick status update with lifecycle timestamps + existing lifecycle helper.
     */
    router.patch(
      "/:id/status",
      async (req: Request, res: Response, next: NextFunction) => {
        try {
          const accountId = req.accountId;
          if (!accountId)
            return res.status(400).json({ message: "Missing accountId" });

          const { id } = req.params;
          if (!Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid work order id" });
          }

          const rawStatus = (req.body?.status || "").trim().toLowerCase();
          if (!rawStatus) {
            return res.status(400).json({ message: "status is required" });
          }

          // Normalize status aliases
          const nextStatus =
            rawStatus === "complete" ? "completed" : rawStatus;

          // ✅ Allowed statuses (keep legacy "invoiced" for now if your DB has it)
          const allowed = [
            "open",
            "in_progress",
            "on_hold",
            "completed",
            "invoiced",  // legacy/optional
            "cancelled",
          ];

          if (!allowed.includes(nextStatus)) {
            return res.status(400).json({
              message: `Invalid status. Allowed: ${allowed.join(", ")}`,
            });
          }

          // Fetch scoped by accountId
          const workOrder = await WorkOrder.findOne({ _id: id, accountId });
          if (!workOrder)
            return res.status(404).json({ message: "Work order not found" });

          const now = new Date();

          // ✅ Assign status
          workOrder.status = nextStatus as any;

          // ✅ Stamp lifecycle times (server is source of truth)
          // Note: only stamp the first time each milestone occurs.
          if (nextStatus === "in_progress") {
            // If you don't actually have startedAt in schema, remove these 2 lines.
            if (!(workOrder as any).startedAt) (workOrder as any).startedAt = now;
          }

          if (nextStatus === "on_hold") {
            // If you don't actually have onHoldAt in schema, remove these 2 lines.
            if (!(workOrder as any).onHoldAt) (workOrder as any).onHoldAt = now;
          }

          if (nextStatus === "completed") {
            if (!workOrder.completedAt) workOrder.completedAt = now;

            // 🔥 Optional: when completing a job, ensure it's not "closed"
            // (closing happens when invoice is paid/void, not when work completes)
            // If you are using closedAt for archive, keep it unset here:
            // workOrder.closedAt = undefined; // only if you want to actively unset
          }

          if (nextStatus === "invoiced") {
            // legacy; if you’re phasing this out, you can keep stamping for old flow
            if (!workOrder.invoicedAt) workOrder.invoicedAt = now;
          }

          if (nextStatus === "cancelled") {
          if (!workOrder.cancelledAt) workOrder.cancelledAt = now;

          // Close the loop: auto-void invoice if cancellable
          if (workOrder.invoiceId) {
            const invoice = await Invoice.findOne({ _id: workOrder.invoiceId, accountId });

            if (invoice && (invoice.status === "draft" || invoice.status === "sent")) {
                invoice.status = "void";
                invoice.financialStatus = "void"; // ✅ one truth
                (invoice as any).voidedAt = now;
                (invoice as any).voidReason = "Work order cancelled";
                await invoice.save();
            }
            
            // ✅ Backfill: if invoice is already void, keep financialStatus in sync
            if (invoice && invoice.status === "void" && invoice.financialStatus !== "void") {
              invoice.financialStatus = "void";
              await invoice.save();
            }


          }
        }


          // ✅ Keep your existing lifecycle helper (does totals, normalization, etc.)
          // Pass the normalized status so it stays consistent
          applyWorkOrderLifecycle(workOrder, { status: nextStatus });

          await workOrder.save();

          res.json(workOrder);
        } catch (err) {
          next(err);
        }
      }
    );



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
