import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";

declare module "express-serve-static-core" {
  interface Request {
    accountId?: Types.ObjectId;
  }
}

export function attachAccountId(req: Request, _res: Response, next: NextFunction) {
  // Phase 1: simple strategy
  // 1. Try header `x-account-id`
  // 2. Fallback to DEFAULT_ACCOUNT_ID from env
  const headerId = req.header("x-account-id");
  const envId = process.env.DEFAULT_ACCOUNT_ID;

  let id: Types.ObjectId | undefined;

  if (headerId && Types.ObjectId.isValid(headerId)) {
    id = new Types.ObjectId(headerId);
  } else if (envId && Types.ObjectId.isValid(envId)) {
    id = new Types.ObjectId(envId);
  }

  if (!id) {
    // For now we don't hard-fail; later for SaaS you *will*
    console.warn("[account] No valid account id found on request");
  }

  req.accountId = id;
  next();
}
