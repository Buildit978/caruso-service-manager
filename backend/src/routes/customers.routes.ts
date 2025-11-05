// src/routes/customers.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { Customer } from '../models/customer.model';  // 👈 named import

const router = Router();

// GET /api/customers?search=...
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { search } = req.query;

        let query = {};
        if (typeof search === 'string' && search.trim() !== '') {
            const regex = new RegExp(search.trim(), 'i'); // case-insensitive
            query = { name: regex };
        }

        const customers = await Customer.find(query).sort({ createdAt: -1 });
        res.json(customers);
    } catch (err) {
        next(err);
    }
});

// GET /api/customers/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const customer = await Customer.findById(req.params.id);
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        res.json(customer);
    } catch (err) {
        next(err);
    }
});

// POST /api/customers
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, phone, email, address, notes } = req.body;

        if (!name || name.trim() === '') {
            return res.status(400).json({ message: 'Name is required' });
        }

        // 👇 this is where it was failing before
        const customer = await Customer.create({
            name: name.trim(),
            phone,
            email,
            address,
            notes,
        });

        res.status(201).json(customer);
    } catch (err) {
        next(err);
    }
});

// PUT /api/customers/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, phone, email, address, notes } = req.body;

        const customer = await Customer.findByIdAndUpdate(
            req.params.id,
            { name, phone, email, address, notes },
            { new: true, runValidators: true }
        );

        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        res.json(customer);
    } catch (err) {
        next(err);
    }
});

// DELETE /api/customers/:id
router.delete(
    '/:id',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const customer = await Customer.findByIdAndDelete(req.params.id);
            if (!customer) {
                return res.status(404).json({ message: 'Customer not found' });
            }
            res.status(204).send();
        } catch (err) {
            next(err);
        }
    }
);

export default router;
