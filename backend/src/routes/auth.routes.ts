import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { User, type UserRole } from "../models/user.model";
import { Settings } from "../models/settings.model";
import { Account } from "../models/account.model";
import { requireAuth } from "../middleware/requireAuth";
import { Types } from "mongoose";
import { validateNewPassword } from "../utils/passwordValidation";

// JWT payload type
interface JwtPayload {
  userId: string;
  accountId: string;
  role: UserRole;
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

// Rate limiting for reactivate endpoint
export const reactivateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === "production" ? 3 : 10,
  message: { message: "Too many reactivation attempts, please try again later." },
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
    const { shopName, ownerName, email, password, betaCode }: {
      shopName?: string;
      ownerName?: string;
      email?: string;
      password?: string;
      betaCode?: string;
    } = req.body;

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

    const now = new Date();
    const betaInviteCode = process.env.BETA_INVITE_CODE;
    const codeMatch =
      typeof betaCode === "string" &&
      betaInviteCode &&
      betaCode.trim() === betaInviteCode.trim();
    const betaCandidate = !!codeMatch;
    const betaCandidateSince = codeMatch ? now : undefined;

    const trialDays = betaCandidate ? 60 : 30;
    const trialEndsAt = new Date(
      now.getTime() + trialDays * 24 * 60 * 60 * 1000
    );

    const account = await Account.create({
      name: String(shopName).trim(),
      isActive: true,
      trialEndsAt,
      isBetaTester: false,
      ...(betaCandidate ? { betaCandidate: true, betaCandidateSince } : { betaCandidate: false }),
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
    const signOptions = {
      expiresIn: tokenExpiry,
    } as SignOptions;
    const token = jwt.sign(payload, secret, signOptions);

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
    const { email, password, shopCode }: {
      email?: string;
      password?: string;
      shopCode?: string;
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const normalizedShopCode =
      typeof shopCode === "string" && shopCode.trim() !== ""
        ? shopCode.trim()
        : undefined;

    let user: any = null;
    let account: any = null;

    if (normalizedShopCode) {
      // Preferred path: scope by shop code (Account.slug)
      account = await Account.findOne({
        slug: normalizedShopCode,
        isActive: true,
      }).lean();

      if (!account) {
        return res.status(404).json({
          message: "Shop code not found. Please check your Shop Code.",
        });
      }

      user = await User.findOne({
        accountId: account._id,
        email: normalizedEmail,
        isActive: true,
      }).lean();

      if (!user) {
        // Do not reveal whether email exists; keep generic
        return res.status(401).json({ message: "Invalid email or password" });
      }
    } else {
      // Backward-compatible path: email-only login when unambiguous
      const candidates = await User.find({
        email: normalizedEmail,
        isActive: true,
      }).lean();

      if (!candidates.length) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const accountIds = Array.from(
        new Set(candidates.map((u) => String(u.accountId)))
      );

      const accounts = await Account.find({
        _id: { $in: accountIds },
      }).lean();

      const activeAccountIds = new Set(
        accounts
          .filter((a) => a && a.isActive !== false)
          .map((a) => String(a._id))
      );

      const activeUsers = candidates.filter((u) =>
        activeAccountIds.has(String(u.accountId))
      );

      if (!activeUsers.length) {
        // All matching users belong to inactive accounts
        return res.status(403).json({ message: "Account inactive" });
      }

      if (activeUsers.length > 1) {
        // Ambiguous across multiple active accounts – require Shop Code
        return res.status(409).json({
          message: "Shop Code required",
          code: "SHOP_CODE_REQUIRED",
        });
      }

      user = activeUsers[0];
      account =
        accounts.find(
          (a) => a && String(a._id) === String(user.accountId)
        ) ?? null;
    }

    // Final safety check on account status
    if (!account || account.isActive === false) {
      return res.status(403).json({ message: "Account inactive" });
    }

    // Compare password with hash
    const passwordMatch = await bcrypt.compare(String(password), user.passwordHash);

    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Check if temporary password has expired
    if (user.tempPasswordExpiresAt) {
      const now = new Date();
      if (now > new Date(user.tempPasswordExpiresAt)) {
        return res.status(401).json({
          message: "Temporary password has expired. Please request a new password reset.",
          code: "TEMP_PASSWORD_EXPIRED",
        });
      }
    }

    // ✅ Check role kill-switch (V1)
    if (user.role === "manager" || user.role === "technician") {
      const settings = await Settings.findOne({
        accountId: new Types.ObjectId(user.accountId),
      }).lean();

      if (!settings || !settings.roleAccess) {
        return res.status(403).json({
          message:
            user.role === "manager"
              ? "Manager access disabled by owner"
              : "Technician access disabled by owner",
        });
      }

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
    const signOptions = {
      expiresIn: tokenExpiry,
    } as SignOptions;
    const token = jwt.sign(payload, secret, signOptions);

    return res.json({
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        role: user.role,
        accountId: user.accountId.toString(),
      },
      mustChangePassword: user.mustChangePassword === true,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/reactivate
 * Public endpoint - reactivates an inactive account (owner-only)
 */
export async function handleReactivate(req: Request, res: Response, next: NextFunction) {
  // Temporary debug: verify route is being hit (route order issue check)
  console.log("🔍 handleReactivate called - route is registered and being hit");
  try {
    const { email, password }: {
      email?: string;
      password?: string;
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Find user by email (case-insensitive via lowercase storage)
    const user = await User.findOne({
      email: String(email).toLowerCase().trim(),
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

    // Require user.role === "owner"
    if (user.role !== "owner") {
      return res.status(403).json({ message: "Only owners can reactivate accounts" });
    }

    // Load user.accountId and the Account
    const account = await Account.findById(user.accountId).lean();

    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    // Set Account.isActive = true
    await Account.updateOne(
      { _id: user.accountId },
      { isActive: true }
    );

    // If users were disabled, set User.isActive = true for users in accountId
    await User.updateMany(
      { accountId: user.accountId },
      { isActive: true }
    );

    // Set tokenInvalidBefore = now for all users in accountId (fresh boundary)
    const now = new Date();
    await User.updateMany(
      { accountId: user.accountId },
      { tokenInvalidBefore: now }
    );

    // Issue JWT and return same shape as /api/auth/login
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
    const signOptions = {
      expiresIn: tokenExpiry,
    } as SignOptions;
    const token = jwt.sign(payload, secret, signOptions);

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

    // Fetch user details (include displayName, firstName, lastName for profile/notes)
    const user = await User.findOne({
      _id: actor._id,
      accountId,
      isActive: true,
    })
      .select("name email role accountId displayName firstName lastName")
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
          displayName: undefined,
          firstName: undefined,
          lastName: undefined,
          isEphemeral: true,
        },
      });
    }

    const u = user as { _id: any; accountId: any; name: string; email: string; role: string; displayName?: string; firstName?: string; lastName?: string };
    return res.json({
      user: {
        id: u._id.toString(),
        role: u.role,
        accountId: u.accountId.toString(),
        name: u.name,
        email: u.email,
        displayName: u.displayName ?? undefined,
        firstName: u.firstName ?? undefined,
        lastName: u.lastName ?? undefined,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/change-password
 * Protected endpoint - change password (forced change flow, no current password required)
 */
export async function handleChangePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const accountId = (req as any).accountId;
    const actor = (req as any).actor;

    if (!accountId || !actor?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { newPassword } = req.body as { newPassword?: string };

    if (!newPassword || typeof newPassword !== "string") {
      return res.status(400).json({ message: "newPassword is required" });
    }

    const validationErrors = validateNewPassword(newPassword);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: validationErrors.join(" "),
        errors: validationErrors,
      });
    }

    const user = await User.findOne({
      _id: actor._id,
      accountId,
      isActive: true,
    });

    if (!user) {
      return res.status(401).json({ message: "User not found or inactive" });
    }

    // Hash new password
    const saltRounds = Number(process.env.BCRYPT_ROUNDS) || 10;
    user.passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Clear mustChangePassword and tempPasswordExpiresAt
    user.mustChangePassword = false;
    user.tempPasswordExpiresAt = null;

    await user.save();

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
