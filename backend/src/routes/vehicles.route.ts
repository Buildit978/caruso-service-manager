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

    let currentOdometer: number | null = null;
    if (odometer !== undefined && odometer !== null && odometer !== "") {
      const n = Number(String(odometer).replace(/,/g, "").trim());
      if (Number.isFinite(n)) {
        currentOdometer = n;
      }
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
      currentOdometer,
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

/**
 * PATCH /api/vehicles/:id  (owner/manager only)
 * Updates an existing vehicle (whitelisted fields only)
 */
router.patch("/:id", requireRole(["owner", "manager"]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = req.accountId;
    if (!accountId) {
      return res.status(400).json({ message: "Missing accountId" });
    }

    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid vehicle id" });
    }

    const updates: any = {};
    const body = req.body ?? {};

    // Whitelisted scalar fields
    if (typeof body.year === "number") {
      updates.year = body.year;
    }
    if (typeof body.make === "string") {
      updates.make = body.make.trim();
    }
    if (typeof body.model === "string") {
      updates.model = body.model.trim();
    }
    if (typeof body.vin === "string") {
      updates.vin = body.vin.trim();
    }
    if (typeof body.licensePlate === "string") {
      updates.licensePlate = body.licensePlate.trim();
    }
    if (typeof body.color === "string") {
      updates.color = body.color.trim();
    }
    if (typeof body.notes === "string") {
      updates.notes = body.notes;
    }

    // Odometer mapping -> currentOdometer (accept number or numeric string)
    const rawOdo = body.odometer;
    if (rawOdo !== undefined && rawOdo !== null && rawOdo !== "") {
      const n = Number(String(rawOdo).replace(/,/g, "").trim());
      if (Number.isFinite(n)) {
        updates.currentOdometer = n;
      }
    }

    // Direct currentOdometer update (number only)
    if (typeof body.currentOdometer === "number" && Number.isFinite(body.currentOdometer)) {
      updates.currentOdometer = body.currentOdometer;
    }

    // Explicitly forbid accountId/customerId changes by not copying them from body

    const vehicle = await Vehicle.findOneAndUpdate(
      { _id: id, accountId },
      { $set: updates },
      { new: true }
    );

    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found" });
    }

    return res.json(vehicle);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/vehicles/:id  (owner/manager only)
 * Deletes a vehicle scoped to the account
 */
router.delete("/:id", requireRole(["owner", "manager"]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = req.accountId;
    if (!accountId) {
      return res.status(400).json({ message: "Missing accountId" });
    }

    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid vehicle id" });
    }

    const result = await Vehicle.deleteOne({ _id: id, accountId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Vehicle not found" });
    }

    return res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
