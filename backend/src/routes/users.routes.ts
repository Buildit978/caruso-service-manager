// backend/src/routes/users.routes.ts
import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/user.model";
import { requireRole } from "../middleware/requireRole";
import { sendEmail } from "../utils/email";

const router = Router();

// Helper: Generate temporary password (12+ characters)
function generateTempPassword(): string {
  const length = 16;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

// Helper: Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * POST /api/users
 * Create a new user under the current account (owner/manager only)
 * V1 Rules:
 * - Owner: can create managers and technicians
 * - Manager: can create technicians ONLY
 * - Technician: cannot create users (blocked by requireRole)
 */
router.post(
  "/",
  requireRole(["owner"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = (req as any).accountId;
      const actor = (req as any).actor;

      if (!accountId || !actor?._id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { firstName, lastName, phone, email, role, password } = req.body;

      // Validate required fields
      if (!email || !role || !firstName || !lastName) {
        return res.status(400).json({ message: "firstName, lastName, email, and role are required" });
      }

      // Validate email format
      if (!isValidEmail(String(email))) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      // V1: Disallow owner creation entirely
      if (role === "owner") {
        return res.status(403).json({ message: "Owner accounts cannot be created via this endpoint" });
      }

      // Owner can create managers or technicians
      if (role !== "manager" && role !== "technician") {
        return res.status(400).json({ message: "Role must be 'manager' or 'technician'" });
      }

      // TODO: Seat limits will be enforced once Stripe subscription limits are synced into DB
      // For now, Stripe owns seat limit enforcement. No in-app blocking.

      // Check if user already exists (unique index on {accountId, email})
      const existingUser = await User.findOne({
        accountId,
        email: String(email).toLowerCase().trim(),
      });

      if (existingUser) {
        if (!existingUser.isActive) {
          return res.status(409).json({
            message: "User exists but is inactive. Use Reactivate.",
          });
        }
        return res.status(409).json({ message: "User with this email already exists" });
      }

      // Generate temporary password if not provided
      const tempPassword = password || generateTempPassword();

      // Hash password
      const saltRounds = Number(process.env.BCRYPT_ROUNDS) || 10;
      const passwordHash = await bcrypt.hash(tempPassword, saltRounds);

      // Create user
      const fullName = `${String(firstName).trim()} ${String(lastName).trim()}`.trim();
      const user = await User.create({
        accountId,
        email: String(email).toLowerCase().trim(),
        firstName: String(firstName).trim(),
        lastName: String(lastName).trim(),
        phone: phone ? String(phone).trim() : undefined,
        name: fullName || String(email).toLowerCase().trim(),
        role,
        passwordHash,
        isActive: true,
      });

      return res.status(201).json({
        user: {
          id: user._id.toString(),
          email: user.email,
          firstName: (user as any).firstName,
          lastName: (user as any).lastName,
          phone: (user as any).phone,
          name: user.name,
          role: user.role,
        },
        tempPassword, // Return temp password only on create
      });
    } catch (err: any) {
      // Handle unique index violation
      if (err.code === 11000) {
        return res.status(409).json({ message: "User with this email already exists" });
      }
      next(err);
    }
  }
);

/**
 * GET /api/users
 * List all users for the current account (owner/manager only)
 */
router.get(
  "/",
  requireRole(["owner"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = (req as any).accountId;

      if (!accountId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const users = await User.find({ accountId })
        .select("-passwordHash") // Exclude password hash
        .sort({ createdAt: -1 })
        .lean();

      return res.json({
        users: users.map((user) => ({
          id: user._id.toString(),
          email: user.email,
          firstName: (user as any).firstName,
          lastName: (user as any).lastName,
          phone: (user as any).phone,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
        })),
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/users/:id/deactivate
 * Deactivate a user (owner/manager only)
 * V1 Rules:
 * - Owner: can deactivate managers and technicians
 * - Manager: can deactivate technicians ONLY
 * - Cannot deactivate owners (always)
 * - Cannot deactivate self (always)
 */
router.patch(
  "/:id/deactivate",
  requireRole(["owner"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = (req as any).accountId;
      const actor = (req as any).actor;

      if (!accountId || !actor?._id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;

      // Find user scoped by accountId
      const user = await User.findOne({
        _id: id,
        accountId,
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent self-deactivation
      if (user._id.toString() === actor._id.toString()) {
        return res.status(400).json({ message: "Cannot deactivate your own account" });
      }

      // V1: Prevent deactivating owners (always)
      if (user.role === "owner") {
        return res.status(403).json({ message: "Cannot deactivate owner accounts" });
      }

      // Owner can deactivate managers and technicians (but never owners)

      // ✅ Deactivate user and revoke all existing tokens immediately
      user.isActive = false;
      user.tokenInvalidBefore = new Date(); // Instant lockout
      await user.save();

      return res.json({
        user: {
          id: user._id.toString(),
          email: user.email,
          firstName: (user as any).firstName,
          lastName: (user as any).lastName,
          phone: (user as any).phone,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/users/:id/reset-password
 * Owner-only: reset password, revoke tokens, send temp password by email.
 */
router.post(
  "/:id/reset-password",
  requireRole(["owner"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = (req as any).accountId;
      const actor = (req as any).actor;
      const { id } = req.params;

      if (!accountId || !actor?._id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      console.log("[ResetPw] start", { accountId: String(accountId), userId: id });

      const user = await User.findOne({ _id: id, accountId });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.role === "owner") {
        return res.status(403).json({ message: "Cannot reset owner password via this endpoint" });
      }

      const toEmail = (user.email || "").trim();
      if (!toEmail || !toEmail.includes("@")) {
        return res.status(400).json({ message: "User has no valid email address" });
      }

      const tempPassword = generateTempPassword();
      const saltRounds = Number(process.env.BCRYPT_ROUNDS) || 10;
      const passwordHash = await bcrypt.hash(tempPassword, saltRounds);

      user.passwordHash = passwordHash;
      user.tokenInvalidBefore = new Date();
      await user.save();

      const subject = "Your password has been reset";
      const text = `Your temporary password has been set. Use it to sign in and change your password.\n\nTemporary password: ${tempPassword}`;

      console.log("[ResetPw] sending email");

      let result: { messageId?: string };
      try {
        result = await sendEmail({ to: toEmail, subject, text });
      } catch (err: any) {
        console.error("[ResetPw] sendEmail failed", {
          message: err?.message,
          code: err?.code,
          response: err?.response,
          responseCode: err?.responseCode,
          command: err?.command,
          stack: err?.stack,
        });
        return res.status(502).json({ ok: false, message: "Email not sent" });
      }

      console.log("[ResetPw] sent", { messageId: result?.messageId });

      const body: { ok: true; tempPassword?: string } = { ok: true };
      if (process.env.ALLOW_TEMP_PASSWORD_RESPONSE === "true") {
        body.tempPassword = tempPassword;
      }
      return res.status(200).json(body);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/users/:id/reactivate
 * Owner-only: reactivate a deactivated user + generate new temp password
 */
router.post(
  "/:id/reactivate",
  requireRole(["owner"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = (req as any).accountId;
      const actor = (req as any).actor;
      const { id } = req.params;

      if (!accountId || !actor?._id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await User.findOne({ _id: id, accountId });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent reactivating owners (safety)
      if (user.role === "owner") {
        return res.status(403).json({ message: "Cannot reactivate owner accounts" });
      }

      // If already active, return error
      if (user.isActive) {
        return res.status(400).json({ message: "User is already active" });
      }

      // Generate new temp password
      const tempPassword = generateTempPassword();
      const saltRounds = Number(process.env.BCRYPT_ROUNDS) || 10;
      const passwordHash = await bcrypt.hash(tempPassword, saltRounds);

      // Reactivate user and invalidate old tokens
      user.isActive = true;
      user.passwordHash = passwordHash;
      user.tokenInvalidBefore = new Date(); // Invalidate old tokens for security
      await user.save();

      return res.json({ tempPassword });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
