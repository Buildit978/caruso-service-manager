// src/routes/workOrders.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { WorkOrder } from '../models/workOrder.model';
import { Customer } from '../models/customer.model';

const router = Router();

// GET /api/work-orders?customerId=...
router.get(
    '/',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const customerId = req.query.customerId as string | undefined;

            const query: Record<string, unknown> = {};

            // Optional filter by customer
            if (customerId) {
                query.customerId = customerId; // MUST match schema field
            }

            const workOrders = await WorkOrder.find(query)
                .populate(
                    'customerId',
                    // expose names + contact info; virtual fullName will be available when serialized
                    'firstName lastName phone email address'
                )
                .sort({ createdAt: -1 });

            res.json(workOrders);
        } catch (err) {
            console.error('Error fetching work orders:', err);
            res.status(500).json({
                message: 'Failed to fetch work orders',
                error: (err as Error).message,
            });
        }
    }
);



// GET /api/work-orders/summary?customerId=...&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get(
    '/summary',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { status, customerId, from, to } = req.query;

            const match: any = {};

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
router.get('/:id', async (req, res) => {
    try {
        const workOrder = await WorkOrder.findById(req.params.id)
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

        res.json(woObj);
    } catch (error) {
        console.error('Error fetching work order by ID:', error);
        res.status(500).json({ message: 'Server error' });
    }
});



// POST /api/work-orders
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
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
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { complaint, diagnosis, notes, odometer, status, vehicle } = req.body;

        const update: any = {
            complaint,
            diagnosis,
            notes,
            odometer,
        };

        if (status) {
            update.status = status;
        }

        if (vehicle) {
            update.vehicle = {
                vehicleId: vehicle.vehicleId,
                year: vehicle.year,
                make: vehicle.make,
                model: vehicle.model,
                vin: vehicle.vin,
                licensePlate: vehicle.licensePlate,
                color: vehicle.color,
                notes: vehicle.notes,
            };
        }

        const workOrder = await WorkOrder.findByIdAndUpdate(
            req.params.id,
            update,
            { new: true, runValidators: true }
        );

        if (!workOrder) {
            return res.status(404).json({ message: 'Work order not found' });
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
            const { status } = req.body;

            if (!status) {
                return res.status(400).json({ message: 'status is required' });
            }

            const workOrder = await WorkOrder.findByIdAndUpdate(
                req.params.id,
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
            const { id } = req.params;
            const deleted = await WorkOrder.findByIdAndDelete(id);

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
