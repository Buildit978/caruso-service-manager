// src/routes/customers.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { Customer } from '../models/customer.model';  // 👈 named import
import { Vehicle } from '../models/vehicle.model';
import { WorkOrder } from '../models/workOrder.model';
import { requireRole } from '../middleware/requireRole';
import { sanitizeCustomerForActor, sanitizeCustomersForActor } from '../utils/customerRedaction';

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

            // GET /api/customers?search=... (owner/manager only)
           router.get(
  "/",
  requireRole(["owner", "manager"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = req.accountId;
      if (!accountId) {
        return res.status(400).json({ message: "Missing accountId" });
      }

      const { search, sortBy, sortDir } = req.query;

      // 🔹 Base query, fully scoped by account
      const baseQuery: any = { accountId };

      // 🔹 Optional search by name (first + last)
      if (typeof search === "string" && search.trim() !== "") {
        const regex = new RegExp(search.trim(), "i"); // case-insensitive
        baseQuery.$or = [{ firstName: regex }, { lastName: regex }];
      }

      // 🔹 Sorting: default to createdAt desc (newest first)
      // sortBy: "name" | "createdAt"
      // sortDir: "asc" | "desc"
      let sort: Record<string, 1 | -1>;

      const dir: 1 | -1 =
        sortDir === "asc"
          ? 1
          : sortDir === "desc"
          ? -1
          : -1; // default desc

      if (sortBy === "name") {
        // We don't have a single "name" field, so we sort by lastName then firstName
        sort = { lastName: dir, firstName: dir };
      } else if (sortBy === "createdAt") {
        sort = { createdAt: dir };
      } else {
        // default: newest customers first
        sort = { createdAt: -1 };
      }

      const customers = await Customer.find(baseQuery)
        .sort(sort)
        .lean();

      if (!customers.length) {
        return res.json(customers);
      }

      // 🔹 Compute active work order counts (open + in_progress) per customer
      const customerIds = customers.map((c) => c._id);

      const matchStage: any = {
        accountId, // 👈 always scope work orders by account
        customerId: { $in: customerIds },
      };

      const activeCounts = await WorkOrder.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              customerId: "$customerId",
              status: { $toLower: { $trim: { input: "$status" } } },
            },
            count: { $sum: 1 },
          },
        },
        {
          $match: {
            "_id.status": { $in: ["open", "in_progress"] },
          },
        },
        {
          $group: {
            _id: "$_id.customerId",
            openWorkOrders: { $sum: "$count" },
          },
        },
      ]);

      const countsByCustomer: Record<string, number> = {};
      for (const row of activeCounts) {
        const key = row._id?.toString?.() ?? "";
        if (key) countsByCustomer[key] = row.openWorkOrders ?? 0;
      }

      const enriched = customers.map((c: any) => ({
        ...c,
        openWorkOrders: countsByCustomer[c._id.toString()] ?? 0,
      }));

      // Redact PII for technicians
      const actorRole = (req as any).actor?.role || "owner";
      const sanitized = sanitizeCustomersForActor(enriched, actorRole);

      res.json(sanitized);
    } catch (err) {
      next(err);
    }
  }
);


// GET /api/customers/:id (owner/manager only)
            router.get("/:id", requireRole(["owner", "manager"]), async (req, res, next) => {
            try {
                const accountId = req.accountId;
                if (!accountId) {
                return res.status(400).json({ message: "Missing accountId" });
                }

                const customer = await Customer.findOne({
                _id: req.params.id,
                accountId,
                }).lean();

                if (!customer) {
                return res.status(404).json({ message: "Customer not found" });
                }

                res.json(customer);
            } catch (err) {
                next(err);
            }
            });


// GET /api/customers/:id/vehicles
            router.get(
            "/:id/vehicles",
            async (req: Request, res: Response, next: NextFunction) => {
                try {
                const accountId = req.accountId;
                if (!accountId) {
                    return res.status(400).json({ message: "Missing accountId" });
                }

                const customerId = req.params.id;

                // Optional but nice: ensure the customer belongs to this account
                const customer = await Customer.findOne({ _id: customerId, accountId }).lean();
                if (!customer) {
                    return res.status(404).json({ message: "Customer not found" });
                }

                const vehicles = await Vehicle.find({
                    accountId,
                    customerId,
                })
                    .sort({ createdAt: -1 })
                    .lean();

                res.json(vehicles);
                } catch (err) {
                next(err);
                }
            }
            );


// POST /api/customers (owner/manager only)
router.post('/', requireRole(["owner", "manager"]), async (req: Request, res: Response, next: NextFunction) => {
    try {

         const accountId = req.accountId;
            if (!accountId) {
            return res.status(400).json({ message: "Missing accountId" });
            }
        
        const { firstName, lastName, phone, email, address, notes } = req.body;

        const customer = await Customer.create({
            accountId,
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


// POST /api/customers/:id/vehicles (owner/manager only)
            router.post(
            "/:id/vehicles",
            requireRole(["owner", "manager"]),
            async (req: Request, res: Response, next: NextFunction) => {
                try {
                const accountId = req.accountId;
                if (!accountId) {
                    return res.status(400).json({ message: "Missing accountId" });
                }

                const customerId = req.params.id;

                // Ensure the customer exists for this account
                const customer = await Customer.findOne({ _id: customerId, accountId }).lean();
                if (!customer) {
                    return res.status(404).json({ message: "Customer not found" });
                }

                const { vin, year, make, model, licensePlate, color, notes } = req.body;

                const vehicle = await Vehicle.create({
                    accountId,
                    customerId,
                    vin,
                    year,
                    make,
                    model,
                    licensePlate,
                    color,
                    notes,
                });

                res.status(201).json(vehicle);
                } catch (err) {
                next(err);
                }
            }
            );



// PATCH /api/customers/:customerId/vehicles/:vehicleId (owner/manager only)
            router.patch(
            "/:customerId/vehicles/:vehicleId",
            requireRole(["owner", "manager"]),
            async (req: Request, res: Response, next: NextFunction) => {
                try {
                const accountId = req.accountId;
                if (!accountId) {
                    return res.status(400).json({ message: "Missing accountId" });
                }

                const { customerId, vehicleId } = req.params;
                const update = { ...req.body, accountId, customerId };

                const vehicle = await Vehicle.findOneAndUpdate(
                    {
                    _id: vehicleId,
                    accountId,
                    customerId,
                    },
                    update,
                    { new: true }
                );

                if (!vehicle) {
                    return res.status(404).json({ message: "Vehicle not found" });
                }

                res.json(vehicle);
                } catch (err) {
                next(err);
                }
            }
            );


// DELETE /api/customers/:customerId/vehicles/:vehicleId (owner/manager only)
            router.delete(
            "/:customerId/vehicles/:vehicleId",
            requireRole(["owner", "manager"]),
            async (req: Request, res: Response, next: NextFunction) => {
                try {
                const accountId = req.accountId;
                if (!accountId) {
                    return res.status(400).json({ message: "Missing accountId" });
                }

                const { customerId, vehicleId } = req.params;

                const result = await Vehicle.deleteOne({
                    _id: vehicleId,
                    accountId,
                    customerId,
                });

                if (result.deletedCount === 0) {
                    return res.status(404).json({ message: "Vehicle not found" });
                }

                res.status(204).end();
                } catch (err) {
                next(err);
                }
            }
            );



// PUT /api/customers/:id (owner/manager only)
            router.put("/:id", requireRole(["owner", "manager"]), async (req, res, next) => {
            try {
                const accountId = req.accountId;
                if (!accountId) {
                return res.status(400).json({ message: "Missing accountId" });
                }

                const customer = await Customer.findOneAndUpdate(
                { _id: req.params.id, accountId },
                req.body,
                { new: true }
                );

                if (!customer) {
                return res.status(404).json({ message: "Customer not found" });
                }

                res.json(customer);
            } catch (err) {
                next(err);
            }
            });




// DELETE /api/customers/:id (owner/manager only)
            router.delete("/:id", requireRole(["owner", "manager"]), async (req, res, next) => {
            try {
                const accountId = req.accountId;
                if (!accountId) {
                return res.status(400).json({ message: "Missing accountId" });
                }

                const result = await Customer.deleteOne({
                _id: req.params.id,
                accountId,
                });

                if (result.deletedCount === 0) {
                return res.status(404).json({ message: "Customer not found" });
                }

                res.status(204).end();
            } catch (err) {
                next(err);
            }
            });

export default router;
