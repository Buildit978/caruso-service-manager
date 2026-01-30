import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model";
import { Account } from "../models/account.model";
import { Settings } from "../models/settings.model";

type ActorRole = "owner" | "manager" | "technician";

interface AuthTokenPayload {
  userId: string;
  accountId: string;
  role: ActorRole;
  iat?: number; // Issued at (timestamp in seconds)
  // allow extra claims but we only rely on these
  [key: string]: unknown;
}

declare module "express-serve-static-core" {
  interface Request {
    accountId?: Types.ObjectId;
    actor?: {
      _id: Types.ObjectId;
      role: ActorRole;
    };
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.AUTH_TOKEN_SECRET;

  if (!secret) {
    return res
      .status(500)
      .json({ message: "Server auth misconfigured" });
  }

  const token = req.header("x-auth-token");

  if (!token || typeof token !== "string") {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, secret) as AuthTokenPayload;

    const { userId, accountId, role, iat } = decoded || ({} as AuthTokenPayload);

    // Basic shape + value checks
    if (
      !userId ||
      !accountId ||
      (role !== "owner" && role !== "manager" && role !== "technician")
    ) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(accountId)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // ✅ Harden: Fetch User from DB to verify active status and get authoritative role
    const user = await User.findOne({
      _id: new Types.ObjectId(userId),
      accountId: new Types.ObjectId(accountId),
      isActive: true,
    }).lean();

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // ✅ Check token revocation (instant lockout)
    if (user.tokenInvalidBefore && iat) {
      // iat is in seconds, convert to milliseconds for comparison
      const tokenIssuedAt = iat * 1000;
      const revocationTime = user.tokenInvalidBefore.getTime();
      if (tokenIssuedAt < revocationTime) {
        return res.status(401).json({ message: "Unauthorized" });
      }
    }

    // ✅ Use DB role (authoritative), not JWT payload role
    const dbRole = user.role;
    if (dbRole !== "owner" && dbRole !== "manager" && dbRole !== "technician") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // ✅ Check Account.isActive
    const account = await Account.findById(accountId).lean();
    if (!account) {
      return res.status(403).json({ message: "Account inactive" });
    }
    if (account.isActive === false) {
      return res.status(403).json({ message: "Account inactive" });
    }

    // ✅ Check role kill-switch (V1) - applies to all authenticated requests
    if (dbRole !== "owner") {
      const settings = await Settings.findOne({
        accountId: new Types.ObjectId(accountId),
      }).lean();

      // Fail-closed: if settings missing, deny access
      if (!settings || !settings.roleAccess) {
        return res.status(403).json({ message: "Access disabled by owner" });
      }

      // Check role-specific toggle
      if (dbRole === "manager" && settings.roleAccess.managersEnabled !== true) {
        return res.status(403).json({ message: "Access disabled by owner" });
      }
      if (dbRole === "technician" && settings.roleAccess.techniciansEnabled !== true) {
        return res.status(403).json({ message: "Access disabled by owner" });
      }
    }

    // Attach normalized context for downstream handlers
    const accountObjectId = new Types.ObjectId(accountId);
    (req as any).accountId = accountObjectId;
    (req as any).actor = {
      _id: new Types.ObjectId(userId),
      role: dbRole, // ✅ Use DB role, not JWT role
    };

    // Throttled tenant activity: update lastActiveAt only if missing or older than 15 minutes
    const now = new Date();
    const cutoff = new Date(now.getTime() - 15 * 60 * 1000);
    Account.updateOne(
      {
        _id: accountObjectId,
        $or: [
          { lastActiveAt: { $exists: false } },
          { lastActiveAt: { $lt: cutoff } },
        ],
      },
      { $set: { lastActiveAt: now } }
    ).catch((err) =>
      console.debug?.("[requireAuth] lastActiveAt update failed", err?.message)
    );

    return next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

