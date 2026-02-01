import type { Request, Response, NextFunction } from "express";

export function adminAuditContext(req: Request, res: Response, next: NextFunction): void {
  const fwd = req.header("x-forwarded-for");
  const ip =
    typeof fwd === "string" && fwd.length ? fwd.split(",")[0].trim() : req.ip;
  const userAgent = req.header("user-agent") || undefined;
  req.auditContext = { ip, userAgent };
  next();
}
