// backend/src/routes/vehicles.route.ts

import { Router, Request, Response, NextFunction } from "express";
import { Vehicle } from "../models/vehicle.model";
import { Types } from "mongoose";
import { Customer } from "../models/customer.model";
import { requireRole } from "../middleware/requireRole";

const router = Router();


function getAccountId(req: Request): string | undefined {
  return req.accountId ? String(req.accountId) : undefined;
}

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * GET /api/vehicles?customerId=123 (owner/manager only)
 * GET /api/vehicles?search=... (owner/manager only)
 * Returns vehicles:
 * - If customerId provided: all vehicles for that customer
 * - If customerId missing: all vehicles for the account (with optional search)
 * - Search matches: make, model, vin (case-insensitive regex), year (exact if search is numeric)
 */
router.get("/", requireRole(["owner", "manager"]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = getAccountId(req);
    if (!accountId) {
      return res.status(400).json({ message: "Missing accountId" });
    }

    const { customerId, search } = req.query;

    // Base query: always scope by accountId
    const query: any = { accountId };

    // If customerId provided, filter by customer (existing behavior)
    if (typeof customerId === "string" && customerId.trim() !== "") {
      query.customerId = customerId.trim();
    }

    // Optional search: make, model, vin (regex), year (exact if numeric)
    if (typeof search === "string" && search.trim() !== "") {
      const searchTerm = search.trim();
      const searchConditions: any[] = [];

      // Text search: make, model, vin (case-insensitive regex)
      const regex = new RegExp(escapeRegex(searchTerm), "i");
      searchConditions.push({ make: regex });
      searchConditions.push({ model: regex });
      searchConditions.push({ vin: regex });

      // Year search: if search term is a number, match year exactly
      const yearNum = Number(searchTerm);
      if (!isNaN(yearNum) && yearNum > 1900 && yearNum < 2100) {
        searchConditions.push({ year: yearNum });
      }

      // Combine search conditions with $or
      if (searchConditions.length > 0) {
        query.$and = query.$and || [];
        query.$and.push({ $or: searchConditions });
      }
    }

    const vehicles = await Vehicle.find(query).sort({ createdAt: -1 });
    return res.json(vehicles);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/vehicles (owner/manager only)
 * Creates a new vehicle for a customer
 */
router.post("/", requireRole(["owner", "manager"]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = getAccountId(req);
    if (!accountId) {
      console.error("[POST /api/vehicles] Missing accountId");
      return res
        .status(500)
        .json({ message: "Account context missing for vehicle creation" });
    }

    const {
      customerId,
      year,
      make,
      model,
      vin,
      licensePlate,
      color,
      notes,
      odometer,
    } = req.body;

    if (!customerId) {
      return res.status(400).json({ message: "customerId is required" });
    }
    if (!make || !model) {
      return res.status(400).json({ message: "make and model are required" });
    }

    const vehicle = await Vehicle.create({
      accountId,
      customerId,
      year,
      make,
      model,
      vin,
      licensePlate,
      color,
      notes,
      currentOdometer:
        typeof odometer === "number"
          ? odometer
          : odometer
          ? Number(odometer)
          : null,
    });

    console.log("[POST /api/vehicles] created", vehicle._id);

    return res.status(201).json(vehicle);
  } catch (err) {
    console.error("[POST /api/vehicles] error", err);
    next(err);
  }
});

// GET /api/vehicles/:id  (owner/manager only)
router.get("/:id", requireRole(["owner", "manager"]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = req.accountId;
    if (!accountId) {
      return res.status(400).json({ message: "Missing accountId" });
    }

    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid vehicle id" });
    }

    const vehicle = await Vehicle.findOne({ _id: id, accountId }).lean();
    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found" });
    }

    return res.json(vehicle);
  } catch (err) {
    next(err);
  }
});



export default router;
