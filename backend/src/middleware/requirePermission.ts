// backend/src/middleware/requirePermission.ts
import type { Request, Response, NextFunction } from "express";
import { Settings } from "../models/settings.model";

/**
 * Middleware factory: requires a specific permission for the actor's role.
 * Owners always have all permissions (bypass check).
 * 
 * Usage: requirePermission("manager.canManageUsers")
 */
export function requirePermission(permissionPath: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = (req as any).accountId;
      const actor = (req as any).actor;

      if (!accountId || !actor?._id || !actor?.role) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Owners always have all permissions
      if (actor.role === "owner") {
        return next();
      }

      // Load settings for this account
      const settings = await Settings.findOne({ accountId }).lean();

      if (!settings || !settings.permissions) {
        // If no settings exist, deny (shouldn't happen, but fail closed)
        return res.status(403).json({ message: "Permission denied" });
      }

      // Parse permission path (e.g., "manager.canManageUsers")
      const [role, permission] = permissionPath.split(".");

      if (role !== actor.role) {
        // Permission path doesn't match actor role
        return res.status(403).json({ message: "Permission denied" });
      }

      // Check permission
      const rolePermissions = settings.permissions[role as keyof typeof settings.permissions];
      if (!rolePermissions || !(permission in rolePermissions)) {
        return res.status(403).json({ message: "Permission denied" });
      }

      const hasPermission = (rolePermissions as any)[permission];
      if (!hasPermission) {
        return res.status(403).json({ message: "Permission denied" });
      }

      return next();
    } catch (err) {
      return res.status(500).json({ message: "Permission check failed" });
    }
  };
}
