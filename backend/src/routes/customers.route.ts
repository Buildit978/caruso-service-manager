// src/routes/customers.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { Customer } from '../models/customer.model';  // 👈 named import

const router = Router();

interface VehicleBody {
    year ?: number;
    make ?: string;
    model ?: string;
    vin ?: string;
    licensePlate ?: string;
    color ?: string;
    notes ?: string;
}

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

router.get(
    "/:id/vehicles",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const customer = await Customer.findById(req.params.id);

            if (!customer) {
                return res.status(404).json({ message: "Customer not found" });
            }

            return res.json(customer.vehicles || []);
        } catch (err) {
            next(err);
        }
    }
);


// POST /api/customers
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { firstName, lastName, phone, email, address, notes } = req.body;

        const customer = await Customer.create({
            firstName,
            lastName,
            phone,
            email,
            address,
            notes
        });

        res.status(201).json(customer);
    } catch (err) {
        next(err);
    }
});


router.post(
    "/:id/vehicles",
    async (req: Request<{}, {}, VehicleBody>, res: Response, next: NextFunction) => {
        try {
            const customer = await Customer.findById(req.params.id);

            if (!customer) {
                return res.status(404).json({ message: "Customer not found" });
            }

            const { year, make, model, vin, licensePlate, color, notes } = req.body;

            const newVehicle = {
                year,
                make,
                model,
                vin,
                licensePlate,
                color,
                notes,
            };

            customer.vehicles.push(newVehicle as any);
            await customer.save();

            // last pushed vehicle
            const created = customer.vehicles[customer.vehicles.length - 1];

            return res.status(201).json(created);
        } catch (err) {
            next(err);
        }
    }
);


// Update a vehicle for a customer
router.patch(
    "/:customerId/vehicles/:vehicleId",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { customerId, vehicleId } = req.params;

            const customer = await Customer.findById(customerId);
            if (!customer) {
                return res.status(404).json({ message: "Customer not found" });
            }

            const vehicle = customer.vehicles.id(vehicleId);
            if (!vehicle) {
                return res.status(404).json({ message: "Vehicle not found" });
            }

            const { year, make, model, vin, licensePlate, color, notes } = req.body;

            if (typeof year !== "undefined") vehicle.year = year;
            if (typeof make !== "undefined") vehicle.make = make;
            if (typeof model !== "undefined") vehicle.model = model;
            if (typeof vin !== "undefined") vehicle.vin = vin;
            if (typeof licensePlate !== "undefined") vehicle.licensePlate = licensePlate;
            if (typeof color !== "undefined") vehicle.color = color;
            if (typeof notes !== "undefined") vehicle.notes = notes;

            await customer.save();

            return res.json(vehicle);
        } catch (err) {
            next(err);
        }
    }
);

// Delete a vehicle from a customer
router.delete(
    "/:customerId/vehicles/:vehicleId",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { customerId, vehicleId } = req.params;

            const customer = await Customer.findById(customerId);
            if (!customer) {
                return res.status(404).json({ message: "Customer not found" });
            }

            const vehicle = customer.vehicles.id(vehicleId);
            if (!vehicle) {
                return res.status(404).json({ message: "Vehicle not found" });
            }

            vehicle.deleteOne(); // remove the subdocument
            await customer.save();

            return res.status(204).send();
        } catch (err) {
            next(err);
        }
    }
);


// PUT /api/customers/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { firstName, lastName, phone, email, address, notes } = req.body;

        const customer = await Customer.findByIdAndUpdate(
            req.params.id,
            { firstName, lastName, phone, email, address, notes },
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
