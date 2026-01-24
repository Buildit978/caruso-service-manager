import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { User } from "../models/user.model";
import { Settings } from "../models/settings.model";
import { Account } from "../models/account.model";
import { requireAuth } from "../middleware/requireAuth";
import { Types } from "mongoose";

// JWT payload type
interface JwtPayload {
  userId: string;
  accountId: string;
  role: "owner" | "manager" | "technician";
}


// Rate limiting for login endpoint
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 5 : 50,
  message: { message: "Too many login attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for register endpoint
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === "production" ? 3 : 10,
  message: { message: "Too many registration attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Helper: Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * POST /api/auth/register
 * Public endpoint - creates new tenant (Account + Owner User)
 */
export async function handleRegister(req: Request, res: Response, next: NextFunction) {
  try {
    const { shopName, ownerName, email, password } = req.body;

    // Validate required fields
    if (!shopName || !ownerName || !email || !password) {
      return res.status(400).json({ message: "shopName, ownerName, email, and password are required" });
    }

    // Validate email format
    if (!isValidEmail(String(email))) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Validate password length
    if (String(password).length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    // Check if email already exists (across all accounts)
    const existingUser = await User.findOne({
      email: String(email).toLowerCase().trim(),
    }).lean();

    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // Create Account
    const account = await Account.create({
      name: String(shopName).trim(),
    });

    // Hash password
    const saltRounds = Number(process.env.BCRYPT_ROUNDS) || 10;
    const passwordHash = await bcrypt.hash(String(password), saltRounds);

    // Create Owner User
    const ownerNameParts = String(ownerName).trim().split(/\s+/);
    const firstName = ownerNameParts[0] || "";
    const lastName = ownerNameParts.slice(1).join(" ") || "";

    const user = await User.create({
      accountId: account._id,
      email: String(email).toLowerCase().trim(),
      firstName,
      lastName,
      name: String(ownerName).trim(),
      role: "owner",
      passwordHash,
      isActive: true,
      tokenInvalidBefore: new Date(), // Start fresh
    });

    // Create default Settings for the account
    await Settings.create({
      accountId: account._id,
      shopName: String(shopName).trim(),
      roleAccess: {
        managersEnabled: true,
        techniciansEnabled: true,
      },
    });

    // Sign JWT token
    const secret = process.env.AUTH_TOKEN_SECRET;
    if (!secret || typeof secret !== "string") {
      return res.status(500).json({ message: "Server auth misconfigured" });
    }

    const tokenExpiry = process.env.AUTH_TOKEN_EXPIRY || "7d";
    const payload: JwtPayload = {
      userId: user._id.toString(),
      accountId: account._id.toString(),
      role: user.role,
    };
    const token = jwt.sign(payload, secret, { expiresIn: tokenExpiry } as jwt.SignOptions);

    return res.status(201).json({
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        role: user.role,
        accountId: account._id.toString(),
      },
    });
  } catch (err: any) {
    // Handle unique index violation
    if (err.code === 11000) {
      return res.status(409).json({ message: "Email already registered" });
    }
    next(err);
  }
}

/**
 * POST /api/auth/login
 * Public endpoint - validates email/password and issues JWT
 */
export async function handleLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Find active user by email (case-insensitive via lowercase storage)
    const user = await User.findOne({
      email: String(email).toLowerCase().trim(),
      isActive: true,
    }).lean();

    if (!user) {
      // Don't reveal if user exists or not (security best practice)
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Compare password with hash
    const passwordMatch = await bcrypt.compare(String(password), user.passwordHash);

    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // ✅ Check role kill-switch (V1)
    if (user.role !== "owner") {
      const settings = await Settings.findOne({
        accountId: new Types.ObjectId(user.accountId),
      }).lean();

      // Fail-closed: if settings missing, deny access
      if (!settings || !settings.roleAccess) {
        if (user.role === "manager") {
          return res.status(403).json({ message: "Manager access disabled by owner" });
        }
        if (user.role === "technician") {
          return res.status(403).json({ message: "Technician access disabled by owner" });
        }
        return res.status(403).json({ message: "Access disabled by owner" });
      }

      // Check role-specific toggle
      if (user.role === "manager" && settings.roleAccess.managersEnabled !== true) {
        return res.status(403).json({ message: "Manager access disabled by owner" });
      }
      if (user.role === "technician" && settings.roleAccess.techniciansEnabled !== true) {
        return res.status(403).json({ message: "Technician access disabled by owner" });
      }
    }

    // Sign JWT token
    const secret = process.env.AUTH_TOKEN_SECRET;
    if (!secret || typeof secret !== "string") {
      return res.status(500).json({ message: "Server auth misconfigured" });
    }

    const tokenExpiry = process.env.AUTH_TOKEN_EXPIRY || "7d";
    const payload: JwtPayload = {
      userId: user._id.toString(),
      accountId: user.accountId.toString(),
      role: user.role,
    };
    const token = jwt.sign(payload, secret, { expiresIn: tokenExpiry } as jwt.SignOptions);

    return res.json({
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        role: user.role,
        accountId: user.accountId.toString(),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/me
 * Protected endpoint - returns current user info
 */
export async function handleMe(req: Request, res: Response, next: NextFunction) {
  try {
    const accountId = (req as any).accountId;
    const actor = (req as any).actor;

    if (!accountId || !actor?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Fetch user details (optional: include name/email if available)
    const user = await User.findOne({
      _id: actor._id,
      accountId,
      isActive: true,
    })
      .select("name email role accountId")
      .lean();

    if (!user) {
      // In production, require User document to exist (strict)
      if (process.env.NODE_ENV === "production") {
        return res.status(401).json({ message: "User not found or inactive" });
      }

      // Dev-only fallback: return ephemeral user from token claims
      return res.json({
        user: {
          id: actor._id.toString(),
          role: actor.role,
          accountId: accountId.toString(),
          name: undefined,
          email: undefined,
          isEphemeral: true,
        },
      });
    }

    return res.json({
      user: {
        id: user._id.toString(),
        role: user.role,
        accountId: user.accountId.toString(),
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    next(err);
  }
}
