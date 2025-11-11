import { Router, Request, Response, NextFunction } from 'express';
import { WorkOrder } from '../models/workOrder.model';

const router = Router();

// POST /api/invoices/from-workorder/:id
router.post('/from-workorder/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workOrder = await WorkOrder.findById(req.params.id).populate('customerId', 'name');
        if (!workOrder) {
            return res.status(404).json({ message: 'Work order not found' });
        }

        // temporary simulated invoice
        const fakeInvoice = {
            invoiceId: Math.floor(Math.random() * 1000000),
            customer: workOrder.customerId,
            workOrderId: workOrder._id,
            total: workOrder.total ?? 0,
            status: 'draft',
            createdAt: new Date(),
        };

        // eventually you'll replace this with Invoice.create(...)
        res.status(201).json(fakeInvoice);
    } catch (err) {
        next(err);
    }
});

export default router;
