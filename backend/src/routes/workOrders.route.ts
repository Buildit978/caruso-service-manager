// src/routes/workOrders.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { isValidObjectId } from 'mongoose';
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
                .populate('customerId', 'name phone email') // populate linked customer
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

// ✅ New route: Get a single work order by ID
router.get('/:id', async (req, res) => {
    try {
        const workOrder = await WorkOrder.findById(req.params.id)
            .populate('customerId'); // populate linked customer info

        if (!workOrder) {
            return res.status(404).json({ message: 'Work order not found' });
        }

        res.json(workOrder);
    } catch (error) {
        console.error('Error fetching work order by ID:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


// GET /api/work-orders/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workOrder = await WorkOrder.findById(req.params.id)
            .populate('customerId', 'name phone email');

        if (!workOrder) {
            return res.status(404).json({ message: 'Work order not found' });
        }

        res.json(workOrder);
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/work-orders/:id
 * Returns a single work order populated with customer
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: 'Invalid work order id.' });
        }

        const wo = await WorkOrder.findById(id)
            .populate('customerId') // ensure this matches your schema’s ref field
            .lean();

        if (!wo) {
            return res.status(404).json({ message: 'Work order not found.' });
        }

        // Normalize shape so frontend can always use .customer
        const normalized = {
            ...wo,
            customer:
                (wo as any).customer ??
                (typeof (wo as any).customerId === 'object' ? (wo as any).customerId : undefined),
        };

        return res.json(normalized);
    } catch (err) {
        next(err);
    }
});




// POST /api/work-orders
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { customerId, complaint, odometer, notes } = req.body;

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
            notes,
            status: 'open',
            date: new Date(),
        });

        res.status(201).json(workOrder);
    } catch (err) {
        next(err);
    }
});

// PUT /api/work-orders/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { complaint, diagnosis, notes, odometer, status } = req.body;

        const update: any = {
            complaint,
            diagnosis,
            notes,
            odometer,
        };

        if (status) {
            update.status = status;
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

export default router;

