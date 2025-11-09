import express, { Request, Response } from 'express';
import { Customer } from '../models/customer.model';
import { WorkOrder } from '../models/workOrder.model';

const router = express.Router();

router.get('/', async (_req: Request, res: Response) => {
    try {
        const totalCustomers = await Customer.countDocuments();

        const openWorkOrders = await WorkOrder.countDocuments({ status: 'open' });
        const completedWorkOrders = await WorkOrder.countDocuments({ status: 'completed' });

        // Safely calculate total revenue from completed work orders
        const completedOrders = await WorkOrder.find({ status: 'completed' }).lean();
        const totalRevenue = completedOrders.reduce((sum, order: any) => {
            const value = typeof order.total === 'number' ? order.total : 0;
            return sum + value;
        }, 0);

        res.json({
            totalCustomers,
            openWorkOrders,
            completedWorkOrders,
            totalRevenue,
        });
    } catch (err) {
        console.error('Error generating summary:', err);
        res.status(500).json({ message: 'Failed to generate summary' });
    }
});

export default router;
