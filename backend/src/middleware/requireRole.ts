import type { Request, Response, NextFunction } from "express";
import type { UserRole } from "../models/user.model";

type Role = Exclude<UserRole, "founding_partner">;

export function requireRole(allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.actor?.role;

    if (!role) return res.status(401).json({ message: "Unauthorized" });
    if (role === "founding_partner" || !allowed.includes(role as Role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  };
}
