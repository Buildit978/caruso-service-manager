// backend/src/middleware/account.middleware.ts
import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";

type ActorRole = "owner" | "manager" | "technician";

declare module "express-serve-static-core" {
  interface Request {
    accountId?: Types.ObjectId;
    actor?: {
      _id: Types.ObjectId;
      role: ActorRole;
    };
  }
}

/**
 * Legacy middleware shim.
 *
 * In Auth v1, identity comes exclusively from requireAuth (x-auth-token).
 * This guard simply ensures that downstream routes do not accidentally
 * run without an authenticated account/actor context.
 */
export function ensureAccountContext(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.accountId || !req.actor?._id || !req.actor?.role) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  return next();
}

