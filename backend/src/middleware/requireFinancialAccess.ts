// backend/src/middleware/requireFinancialAccess.ts
import type { Request, Response, NextFunction } from "express";
import { Settings } from "../models/settings.model";
import { Types } from "mongoose";

/**
 * Middleware to enforce financial access based on role and permissions.
 * - Owners: always allowed
 * - Managers: allowed only if permissions.manager.canSeeFinancials === true
 * - Technicians: always denied (403)
 */
export async function requireFinancialAccess(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const actorRole = (req as any).actor?.role;
  const accountId = (req as any).accountId;

  if (!actorRole || !accountId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Owners always have access
  if (actorRole === "owner") {
    return next();
  }

  // Technicians are always denied
  if (actorRole === "technician") {
    return res.status(403).json({ message: "Access Restricted" });
  }

  // Managers: check permissions flag
  if (actorRole === "manager") {
    try {
      const settings = await Settings.findOne({
        accountId: new Types.ObjectId(accountId),
      }).lean();

      // If no settings or permissions not configured, deny by default (fail-closed)
      if (!settings || !settings.permissions?.manager?.canSeeFinancials) {
        return res.status(403).json({ message: "Access Restricted" });
      }

      // Check the flag
      if (settings.permissions.manager.canSeeFinancials !== true) {
        return res.status(403).json({ message: "Access Restricted" });
      }

      // Manager has permission
      return next();
    } catch (error) {
      console.error("Error checking financial access:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  // Unknown role
  return res.status(403).json({ message: "Access Restricted" });
}
