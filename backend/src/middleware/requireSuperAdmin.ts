import type { Request, Response, NextFunction } from "express";

/**
 * requireSuperAdmin middleware
 * Assumes requireAdminAuth already ran and set req.adminActor
 * Returns 403 if role is not "superadmin"
 */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const adminActor = (req as any).adminActor;
  
  if (!adminActor || adminActor.role !== "superadmin") {
    return res.status(403).json({ message: "Forbidden" });
  }
  
  return next();
}
