// backend/src/middleware/account.middleware.ts
import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";

type ActorRole = "owner" | "manager" | "technician";

declare module "express-serve-static-core" {
  interface Request {
    accountId?: Types.ObjectId;
    actor?: {
      role: ActorRole;
    };
  }
}

function normalizeRole(raw: unknown): ActorRole {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "owner" || v === "manager" || v === "technician") return v;
  return "owner"; // safe default; preserves current behavior
}

export function attachAccountId(req: Request, res: Response, next: NextFunction) {
  const headerId = req.header("x-account-id");
  const envId = process.env.DEFAULT_ACCOUNT_ID;

  let id: Types.ObjectId | null = null;

  if (headerId && Types.ObjectId.isValid(headerId)) {
    id = new Types.ObjectId(headerId);
  } else if (envId && Types.ObjectId.isValid(envId)) {
    id = new Types.ObjectId(envId);
  }

  if (!id) {
    console.error(
      "[account] No valid account id found on request. headerId=%s envId=%s",
      headerId,
      envId
    );
    return res.status(500).json({ message: "Account not configured on server" });
  }

  req.accountId = id;

  // ✅ Minimal actor context (no auth system yet)
  // Later: replace header-based role with real user auth.
  req.actor = { role: normalizeRole(req.header("x-caruso-role")) };

  next();
}
