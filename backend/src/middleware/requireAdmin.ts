import type { Request, Response, NextFunction } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const role = req.actor?.role;

  if (!role) return res.status(401).json({ message: "Unauthorized" });
  if (role !== "superadmin") return res.status(403).json({ message: "Forbidden" });

  next();
}
