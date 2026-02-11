// src/routes/customers.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { Customer } from '../models/customer.model';  // 👈 named import
import { Vehicle } from '../models/vehicle.model';
import { WorkOrder } from '../models/workOrder.model';
import { requireRole } from '../middleware/requireRole';
import { requireBillingActive } from '../middleware/requireBillingActive';
import { sanitizeCustomerForActor, sanitizeCustomersForActor } from '../utils/customerRedaction';
import { trackEvent } from '../utils/trackEvent';

const router = Router();

// Multer configuration for CSV uploads (memory storage, 2MB limit)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

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

// GET /api/customers/export (owner only)
router.get(
  "/export",
  requireRole(["owner"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = req.accountId;
      if (!accountId) {
        return res.status(400).json({ message: "Missing accountId" });
      }

      const customers = await Customer.find({ accountId })
        .select("firstName lastName phone email address notes")
        .lean();

      // Build CSV content
      const headers = ["firstName", "lastName", "phone", "email", "address", "notes"];
      const csvRows = [headers.join(",")];

      for (const customer of customers) {
        const escapeCsv = (value: any): string => {
          if (value == null || value === "") return "";
          const str = String(value);
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };

        const row = [
          escapeCsv(customer.firstName),
          escapeCsv(customer.lastName),
          escapeCsv(customer.phone),
          escapeCsv(customer.email),
          escapeCsv(customer.address),
          escapeCsv(customer.notes),
        ];
        csvRows.push(row.join(","));
      }

      const csvContent = csvRows.join("\n");
      const dateStr = new Date().toISOString().split("T")[0];

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=customers-${dateStr}.csv`);
      res.send(csvContent);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/customers/import (owner only)
router.post(
  "/import",
  requireBillingActive,
  requireRole(["owner"]),
  upload.single("file"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = req.accountId;
      if (!accountId) {
        return res.status(400).json({ message: "Missing accountId" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Parse CSV
      let records: any[];
      try {
        records = parse(req.file.buffer.toString("utf-8"), {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        });
      } catch (parseErr) {
        return res.status(400).json({ message: "Invalid CSV format", error: String(parseErr) });
      }

      if (!records.length) {
        return res.status(400).json({ message: "CSV file is empty" });
      }

      // Header normalization mapping
      const headerMap: Record<string, string> = {
      // firstName aliases
      first: "firstName",
      fname: "firstName",
      "given name": "firstName",
      firstname: "firstName",

      // lastName aliases
      last: "lastName",
      lname: "lastName",
      surname: "lastName",
      "family name": "lastName",
      lastname: "lastName",

      // fullName aliases
      name: "fullName",
      "full name": "fullName",
      "customer name": "fullName",
      client: "fullName",
      fullname: "fullName",

      // phone aliases
      phone: "phone",
      mobile: "phone",
      cell: "phone",
      tel: "phone",

      // email aliases
      email: "email",
      "e-mail": "email",

      // address aliases
      address: "address",
      street: "address",
      "street address": "address",

      // notes aliases
      notes: "notes",
      note: "notes",
};


      // Normalize headers in records
      const normalizedRecords = records.map((record: any) => {
        const normalized: any = {};
        for (const [key, value] of Object.entries(record)) {
          const normalizedKey = headerMap[key.toLowerCase().trim()];
          if (normalizedKey) {
            if (normalized[normalizedKey]) {
              // If key already exists, prefer non-empty value
              if (!normalized[normalizedKey] && value) {
                normalized[normalizedKey] = value;
              }
            } else {
              normalized[normalizedKey] = value;
            }
          }
        }
        return normalized;
      });

      // Helper: extract digits only from phone
      const extractDigits = (phone: string | undefined): string => {
        if (!phone) return "";
        return phone.replace(/\D/g, "");
      };

      // Helper: split fullName if first/last missing
      const processFullName = (record: any): void => {
        if (record.fullName && (!record.firstName || !record.lastName)) {
          const fullName = String(record.fullName || "").trim();
          if (fullName) {
            const spaceIndex = fullName.indexOf(" ");
            if (spaceIndex > 0) {
              record.firstName = fullName.substring(0, spaceIndex).trim();
              record.lastName = fullName.substring(spaceIndex + 1).trim();
            } else {
              // No space found, treat entire string as firstName
              record.firstName = fullName;
              record.lastName = "";
            }
          }
          delete record.fullName;
        }
      };

      const summary = {
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        errors: [] as Array<{ row: number; message: string }>,
      };

      // Process each record
      for (let i = 0; i < normalizedRecords.length; i++) {
        const rowNum = i + 2; // +2 because CSV rows are 1-indexed and we skip header
        const record = normalizedRecords[i];

        try {
          // Process fullName if needed
          processFullName(record);

          // Validate required fields
          if (!record.firstName) {
            summary.skipped++;
            summary.errors.push({
              row: rowNum,
              message: "Missing required field: firstName is required",
            });
            continue;
          }

          const firstName = String(record.firstName || "").trim();
          const lastName = String(record.lastName || "").trim() || "";
          const phone = record.phone ? String(record.phone).trim() : undefined;
          const email = record.email ? String(record.email).trim().toLowerCase() : undefined;
          const address = record.address ? String(record.address).trim() : undefined;
          const notes = record.notes ? String(record.notes).trim() : undefined;

          // Deduplication: find existing customer by email (case-insensitive) or phone (digits-only)
          let existingCustomer = null;

          if (email) {
            existingCustomer = await Customer.findOne({
              accountId,
              email: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
            }).lean();
          }

          if (!existingCustomer && phone) {
            const phoneDigits = extractDigits(phone);
            if (phoneDigits) {
              const existingCustomers = await Customer.find({ accountId, phone: { $exists: true } }).lean();
              existingCustomer = existingCustomers.find((c) => {
                const existingDigits = extractDigits(c.phone);
                return existingDigits && existingDigits === phoneDigits;
              });
            }
          }

          // Create or update
          if (existingCustomer) {
            await Customer.findOneAndUpdate(
              { _id: existingCustomer._id, accountId },
              {
                firstName,
                lastName,
                ...(phone !== undefined && { phone }),
                ...(email !== undefined && { email }),
                ...(address !== undefined && { address }),
                ...(notes !== undefined && { notes }),
              },
              { new: true }
            );
            summary.updated++;
          } else {
            await Customer.create({
              accountId,
              firstName,
              lastName,
              phone,
              email,
              address,
              notes,
            });
            summary.created++;
          }
        } catch (err: any) {
          summary.failed++;
          summary.errors.push({
            row: rowNum,
            message: err.message || "Failed to process row",
          });
        }
      }

      res.json(summary);
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
router.post('/', requireBillingActive, requireRole(["owner", "manager"]), async (req: Request, res: Response, next: NextFunction) => {
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

        trackEvent({
          req,
          type: "customer_created",
          entity: { kind: "customer", id: customer._id },
        });

        res.status(201).json(customer);
    } catch (err) {
        next(err);
    }
});


// POST /api/customers/:id/vehicles (owner/manager only)
            router.post(
            "/:id/vehicles",
            requireBillingActive,
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
            requireBillingActive,
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
            requireBillingActive,
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
            router.put("/:id", requireBillingActive, requireRole(["owner", "manager"]), async (req, res, next) => {
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
            router.delete("/:id", requireBillingActive, requireRole(["owner", "manager"]), async (req, res, next) => {
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
