import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import jwt from "jsonwebtoken";
import { User, type UserRole } from "../models/user.model";

interface AdminTokenPayload {
  userId?: string;
  adminUserId?: string;
  iat?: number;
  [key: string]: unknown;
}

export async function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
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
    const decoded = jwt.verify(token, secret) as AdminTokenPayload;

    const { userId, adminUserId, iat } = decoded || ({} as AdminTokenPayload);
    const resolvedUserId = adminUserId ?? userId;

    if (!resolvedUserId || !Types.ObjectId.isValid(resolvedUserId)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await User.findOne({
      _id: new Types.ObjectId(resolvedUserId),
    }).lean();

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (user.tokenInvalidBefore && iat) {
      const tokenIssuedAt = iat * 1000;
      const revocationTime = user.tokenInvalidBefore.getTime();
      if (tokenIssuedAt < revocationTime) {
        return res.status(401).json({ message: "Unauthorized" });
      }
    }

    if (user.role !== "admin" && user.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    req.adminActor = {
      _id: user._id,
      role: user.role as UserRole,
    };

    return next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
}
