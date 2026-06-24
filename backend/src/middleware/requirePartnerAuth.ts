import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import jwt from "jsonwebtoken";
import { FoundingPartner } from "../models/foundingPartner.model";
import { User } from "../models/user.model";
import { getSystemAccount } from "../utils/getSystemAccount";

interface PartnerTokenPayload {
  partnerUserId?: string;
  foundingPartnerId?: string;
  accountId?: string;
  role?: string;
  iat?: number;
  sv?: number;
  [key: string]: unknown;
}

declare module "express-serve-static-core" {
  interface Request {
    partnerActor?: {
      partnerId: Types.ObjectId;
      userId: Types.ObjectId;
      role: "founding_partner";
    };
  }
}

export async function requirePartnerAuth(req: Request, res: Response, next: NextFunction) {
  function deny(code?: string) {
    if (process.env.NODE_ENV !== "production" && code) {
      return res.status(401).json({ message: "Unauthorized", code });
    }
    return res.status(401).json({ message: "Unauthorized" });
  }

  const secret = process.env.AUTH_TOKEN_SECRET;
  if (!secret) {
    return res.status(500).json({ message: "Server auth misconfigured" });
  }

  const token = req.header("x-auth-token");
  if (!token || typeof token !== "string") {
    return deny("NO_TOKEN");
  }

  try {
    const decoded = jwt.verify(token, secret) as PartnerTokenPayload;
    const { partnerUserId, foundingPartnerId, accountId, role, iat, sv } = decoded || {};

    if (
      role !== "founding_partner" ||
      !partnerUserId ||
      !foundingPartnerId ||
      !accountId ||
      !Types.ObjectId.isValid(partnerUserId) ||
      !Types.ObjectId.isValid(foundingPartnerId) ||
      !Types.ObjectId.isValid(accountId)
    ) {
      return deny("BAD_CLAIMS");
    }

    const systemAccount = await getSystemAccount();
    if (!systemAccount || String(systemAccount._id) !== accountId) {
      return deny("BAD_ACCOUNT");
    }

    const user = await User.findOne({
      _id: new Types.ObjectId(partnerUserId),
      accountId: systemAccount._id,
      role: "founding_partner",
      isActive: true,
    }).lean();

    if (!user) {
      return deny("USER_NOT_FOUND");
    }

    const tokenSv = typeof sv === "number" ? sv : 0;
    const userSv = typeof user.sessionVersion === "number" ? user.sessionVersion : 0;
    if (tokenSv !== userSv) {
      return deny("SESSION_REVOKED");
    }

    const tokenIatSec = typeof iat === "number" ? iat : undefined;
    const revocationSec = user.tokenInvalidBefore
      ? Math.floor(new Date(user.tokenInvalidBefore).getTime() / 1000)
      : undefined;

    if (tokenIatSec !== undefined && revocationSec !== undefined && tokenIatSec < revocationSec) {
      return deny("TOKEN_REVOKED");
    }

    const partner = await FoundingPartner.findOne({
      _id: new Types.ObjectId(foundingPartnerId),
      userId: user._id,
      status: "active",
    }).lean();

    if (!partner) {
      return res.status(403).json({ message: "Partner access unavailable" });
    }

    req.partnerActor = {
      partnerId: partner._id as Types.ObjectId,
      userId: user._id as Types.ObjectId,
      role: "founding_partner",
    };

    return next();
  } catch {
    return deny("JWT_VERIFY_FAILED");
  }
}
