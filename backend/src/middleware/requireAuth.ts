import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import jwt from "jsonwebtoken";

type ActorRole = "owner" | "manager" | "technician";

interface AuthTokenPayload {
  userId: string;
  accountId: string;
  role: ActorRole;
  // allow extra claims but we only rely on these three
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

export function requireAuth(req: Request, res: Response, next: NextFunction) {
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

    const { userId, accountId, role } = decoded || ({} as AuthTokenPayload);

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

    // Attach normalized context for downstream handlers
    (req as any).accountId = new Types.ObjectId(accountId);
    (req as any).actor = {
      _id: new Types.ObjectId(userId),
      role,
    };

    return next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

