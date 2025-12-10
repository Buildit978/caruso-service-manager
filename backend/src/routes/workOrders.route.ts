// src/routes/workOrders.routes.ts
import { Types } from 'mongoose';
import { Router, Request, Response, NextFunction } from 'express';
import { WorkOrder } from '../models/workOrder.model';
import { Customer } from '../models/customer.model';
import { attachAccountId } from '../middleware/account.middleware';

const router = Router();

router.use(attachAccountId);

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = req.accountId;
    if (!accountId) {
      return res.status(400).json({ message: "Missing accountId" });
    }

    const { status } = req.query;

    const filter: any = { accountId };

    if (typeof status === "string" && status.trim() !== "" && status !== "all") {
      filter.status = status;
    }

    const workOrders = await WorkOrder.find(filter)
      .sort({ createdAt: -1 })
      .populate("customerId")
      .lean();

    res.json(workOrders);
  } catch (err) {
    next(err);
  }
});




// GET /api/work-orders/summary?customerId=...&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get(
    '/summary',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const accountId = req.accountId;
            if (!accountId) {
                return res.status(400).json({ message: "Missing accountId" });
            }

            const { status, customerId, from, to } = req.query;

            const match: any = { accountId };

            // Optional filter: status
            if (typeof status === 'string' && status.trim() !== '') {
                match.status = status;
            }

            // Optional filter: customerId
            if (typeof customerId === 'string' && customerId.trim() !== '') {
                match.customerId = customerId;
            }

            // Optional filter: date range
            if (typeof from === 'string' || typeof to === 'string') {
                match.date = {};

                if (typeof from === 'string' && from.trim() !== '') {
                    const fromDate = new Date(from);
                    if (!isNaN(fromDate.getTime())) {
                        match.date.$gte = fromDate;
                    }
                }

                if (typeof to === 'string' && to.trim() !== '') {
                    const toDate = new Date(to);
                    if (!isNaN(toDate.getTime())) {
                        match.date.$lte = toDate;
                    }
                }

                if (Object.keys(match.date).length === 0) {
                    delete match.date;
                }
            }

            // Aggregate counts by status
            const result = await WorkOrder.aggregate([
                { $match: match },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                    },
                },
            ]);

            // Normalize into a fixed shape
            const summary: Record<string, number> = {
                open: 0,
                in_progress: 0,
                completed: 0,
                invoiced: 0,
            };

            for (const row of result) {
                summary[row._id] = row.count;
            }

            res.json(summary);
        } catch (err) {
            next(err);
        }
    }
);

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
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {

        const accountId = req.accountId;
        if (!accountId) {
        return res.status(400).json({ message: "Missing accountId" });
        }

        const { customerId, complaint, odometer, diagnosis, notes, vehicle } = req.body;

        if (!customerId) {
            return res.status(400).json({ message: 'customerId is required' });
        }
        if (!complaint || complaint.trim() === '') {
            return res.status(400).json({ message: 'complaint is required' });
        }

        // ensure customer exists
        const customer = await Customer.findById(customerId);
        if (!customer) {
            return res.status(400).json({ message: 'Invalid customerId' });
        }

        const workOrder = await WorkOrder.create({
            accountId, 
            customerId,
            complaint: complaint.trim(),
            odometer,
            diagnosis,
            notes,
            vehicle,   // 👈 save snapshot into schema
            status: 'open',
            date: new Date(),
        });

        await workOrder.save();

        res.status(201).json(workOrder);
    } catch (err) {
        next(err);
    }
});



// PUT /api/work-orders/:id
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


router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = req.accountId;
    if (!accountId) {
      return res.status(400).json({ message: "Missing accountId" });
    }

    const workOrder = await WorkOrder.findOneAndUpdate(
      { _id: req.params.id, accountId },
      req.body,
      { new: true }
    );

    if (!workOrder) {
      return res.status(404).json({ message: "Work order not found" });
    }

    res.json(workOrder);
  } catch (err) {
    next(err);
  }
});



// PATCH /api/work-orders/:id/status  (for quick status updates)
router.patch(
    '/:id/status',
    async (req: Request, res: Response, next: NextFunction) => {
        try {

            const accountId = req.accountId;
            if (!accountId) {
                return res.status(400).json({ message: "Missing accountId" });
            }
            
            const { status } = req.body;

            if (!status) {
                return res.status(400).json({ message: 'status is required' });
            }

            const workOrder = await WorkOrder.findOneAndUpdate(
                { _id: req.params.id, accountId },
                { status },
                { new: true, runValidators: true }
            );

            if (!workOrder) {
                return res.status(404).json({ message: 'Work order not found' });
            }

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
