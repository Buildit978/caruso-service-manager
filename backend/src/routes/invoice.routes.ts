import { Router, Request, Response, NextFunction } from 'express';
import { WorkOrder } from '../models/workOrder.model';
import { Invoice } from '../models/invoice.model';

const router = Router();

// POST /api/invoices/from-workorder/:id
/**
 * POST /api/invoices
 * Body can be:
 * - Full invoice data (customerId, items, etc.)
 * - Or just { workOrderId } to auto-generate a simple invoice from a work order
 */
router.post(
    '/',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const {
                customerId,
                workOrderId,
                items,
                status,
                issuedAt,
            } = req.body as {
                customerId?: string;
                workOrderId?: string;
                items?: {
                    description: string;
                    quantity: number;
                    unitPrice: number;
                    lineTotal: number;
                }[];
                status?: 'draft' | 'sent' | 'paid' | 'void';
                issuedAt?: string;
            };

            let finalItems = items ?? [];
            let finalCustomerId = customerId;
            let finalWorkOrderId = workOrderId;

            // Simple "create from work order" flow:
            // If we got a workOrderId but no items, we auto-generate
            if (workOrderId && (!items || items.length === 0)) {
                const workOrder = await WorkOrder.findById(workOrderId).populate(
                    'customerId'
                );

                if (!workOrder) {
                    return res.status(404).json({ message: 'Work order not found' });
                }

                finalCustomerId =
                    finalCustomerId || (workOrder.customerId as any)?._id?.toString();

                // Adjust these fields to match your WorkOrder schema
                const description =
                    (workOrder as any).description ||
                    `Work order ${workOrder._id.toString()}`;
                const workOrderTotal = (workOrder as any).total || 0;

                finalItems = [
                    {
                        description,
                        quantity: 1,
                        unitPrice: workOrderTotal,
                        lineTotal: workOrderTotal,
                    },
                ];
            }

            if (!finalCustomerId) {
                return res
                    .status(400)
                    .json({ message: 'customerId is required to create an invoice.' });
            }

            if (!finalItems || finalItems.length === 0) {
                return res
                    .status(400)
                    .json({ message: 'Invoice must have at least one item.' });
            }

            const total = finalItems.reduce(
                (sum, item) => sum + item.lineTotal,
                0
            );

            const invoice = new Invoice({
                customerId: finalCustomerId,
                workOrderId: finalWorkOrderId,
                items: finalItems,
                total,
                status: status || 'draft',
                issuedAt: issuedAt ? new Date(issuedAt) : new Date(),
            });

            await invoice.save();

            // You get back the populated invoice if needed later
            res.status(201).json(invoice);
        } catch (err) {
            next(err);
        }
    }
);

/**
 * GET /api/invoices
 * Optional query params:
 * - ?customerId=<id>
 * - ?workOrderId=<id>
 */
router.get(
    '/',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { customerId, workOrderId } = req.query;

            const filter: Record<string, any> = {};
            if (customerId) filter.customerId = customerId;
            if (workOrderId) filter.workOrderId = workOrderId;

            const invoices = await Invoice.find(filter)
                .sort({ issuedAt: -1 })
                .populate('customerId')
                .populate('workOrderId');

            res.json(invoices);
        } catch (err) {
            next(err);
        }
    }
);

/**
 * GET /api/invoices/:id
 */
router.get(
    '/:id',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const invoice = await Invoice.findById(id)
                .populate('customerId')
                .populate('workOrderId');

            if (!invoice) {
                return res.status(404).json({ message: 'Invoice not found' });
            }

            res.json(invoice);
        } catch (err) {
            next(err);
        }
    }
);

/*router.post('/from-workorder/:id', async (req: Request, res: Response, next: NextFunction) => {
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
*/
export default router;
