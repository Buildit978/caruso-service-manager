// backend/src/routes/vehicles.route.ts

import { Router, Request, Response, NextFunction } from "express";
import { Vehicle } from "../models/vehicle.model";
import { Types } from "mongoose";
import { Customer } from "../models/customer.model";

const router = Router();


function getAccountId(req: Request): string | undefined {
  return req.accountId ? String(req.accountId) : undefined;
}

/**
 * GET /api/vehicles?customerId=123
 * Returns all vehicles for a given customer
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerId } = req.query;

    if (!customerId) {
      return res.status(400).json({ message: "customerId is required" });
    }

    const accountId = getAccountId(req);

    const query: any = { customerId };
    if (accountId) {
      query.accountId = accountId;
    }

    const vehicles = await Vehicle.find(query).sort({ createdAt: -1 });
    return res.json(vehicles);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/vehicles
 * Creates a new vehicle for a customer
 */
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
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

// GET /api/vehicles/:id  (vehicle subdoc id)
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
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
