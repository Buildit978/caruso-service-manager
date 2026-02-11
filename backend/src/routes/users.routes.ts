// backend/src/routes/users.routes.ts
import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/user.model";
import { Account } from "../models/account.model";
import { requireRole } from "../middleware/requireRole";
import { requireBillingActive } from "../middleware/requireBillingActive";
import { sendEmail } from "../utils/email";
import { generateTempPassword } from "../utils/password";

const router = Router();

// Helper: Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Helper: Get tenant login URL
function getTenantLoginUrl(): string {
  const baseUrl = (process.env.APP_BASE_URL || "http://localhost:5173").replace(/\/$/, "");
  return `${baseUrl}/login`;
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
  requireBillingActive,
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

      // Fetch Account.slug for shopCode
      const account = await Account.findById(accountId).select("slug").lean();
      const shopCode = account?.slug || null;

      // Send invite email
      const toEmail = user.email;
      let emailSent = false;
      let emailError: string | undefined = undefined;

      try {
        const loginUrl = getTenantLoginUrl();
        const displayShopCode = shopCode || "(not available)";
        const subject = "Welcome to Caruso Service Manager";
        const text = `You've been invited to join Caruso Service Manager as a ${role}.\n\n` +
          `Shop Code: ${displayShopCode}\n` +
          `Role: ${role}\n` +
          `Email: ${toEmail}\n` +
          `Login URL: ${loginUrl}\n` +
          `Temporary password: ${tempPassword}\n\n` +
          `Please sign in and change your password.`;

        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <p>You've been invited to join Caruso Service Manager as a <strong>${role}</strong>.</p>
  
  <div style="border: 1px solid #ddd; padding: 12px; margin: 16px 0; background-color: #f9f9f9;">
    <p style="margin: 0 0 8px 0;"><strong>Shop Code:</strong> <span style="font-size: 18px; font-weight: bold;">${displayShopCode}</span></p>
    <p style="margin: 0;"><strong>Temporary Password:</strong> <span style="font-size: 18px; font-weight: bold;">${tempPassword}</span></p>
  </div>
  
  <p><strong>Role:</strong> ${role}</p>
  <p><strong>Email:</strong> ${toEmail}</p>
  <p><strong>Login URL:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
  
  <p>Please sign in and change your password.</p>
</body>
</html>`;

        const result = await sendEmail({
          to: toEmail,
          subject,
          text,
          html,
          accountId,
        });

        emailSent = true;
        console.log("[TENANT_INVITE_EMAIL] sent", {
          to: toEmail,
          role,
          accountId: String(accountId),
          shopCode,
          messageId: result.messageId,
        });
      } catch (err: unknown) {
        emailSent = false;
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        emailError = "Invite email could not be sent. Please copy the temporary password and share it with the team member.";
        console.error("[TENANT_INVITE_EMAIL] failed", {
          to: toEmail,
          role,
          accountId: String(accountId),
          shopCode,
          err: errorMessage,
        });
      }

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
        shopCode,
        emailSent,
        ...(emailError ? { emailError } : {}),
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
 * PATCH /api/users/me
 * Update current user profile (displayName only). Requires auth.
 */
const DISPLAY_NAME_MAX_LENGTH = 40;
router.patch("/me", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = (req as any).accountId;
    const actor = (req as any).actor;
    if (!accountId || !actor?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { displayName: rawDisplayName } = req.body as { displayName?: unknown };
    if (rawDisplayName !== undefined) {
      if (typeof rawDisplayName !== "string") {
        return res.status(400).json({ message: "displayName must be a string" });
      }
      const trimmed = String(rawDisplayName).trim();
      if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
        return res.status(400).json({
          message: `displayName must be at most ${DISPLAY_NAME_MAX_LENGTH} characters`,
        });
      }
    }

    const user = await User.findOne({
      _id: actor._id,
      accountId,
      isActive: true,
    });
    if (!user) {
      return res.status(401).json({ message: "User not found or inactive" });
    }

    if (rawDisplayName !== undefined) {
      (user as any).displayName = String(rawDisplayName).trim();
    }
    await user.save();

    const u = user.toObject ? user.toObject() : (user as any);
    return res.json({
      id: u._id.toString(),
      email: u.email,
      role: u.role,
      name: u.name,
      firstName: u.firstName,
      lastName: u.lastName,
      displayName: u.displayName ?? undefined,
    });
  } catch (err) {
    next(err);
  }
});

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
  requireBillingActive,
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

      // Set temp password expiry to 60 minutes from now
      const tempPasswordExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

      user.passwordHash = passwordHash;
      user.tokenInvalidBefore = new Date();
      user.mustChangePassword = true;
      user.tempPasswordExpiresAt = tempPasswordExpiresAt;
      await user.save();

      // Fetch Account.slug for shopCode (needed for email and response)
      const account = await Account.findById(accountId).select("slug").lean();
      const shopCode = account?.slug || null;
      const displayShopCode = shopCode || "(not available)";

      // Send reset password email
      let emailSent = false;
      let emailError: string | undefined = undefined;

      try {
        const loginUrl = getTenantLoginUrl();
        const subject = "Your password has been reset";
        const text = `Your temporary password has been set. Use it to sign in and change your password.\n\n` +
          `Shop Code: ${displayShopCode}\n` +
          `Temporary password: ${tempPassword}\n` +
          `Login URL: ${loginUrl}\n\n` +
          `This password expires in 60 minutes.`;

        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <p>Your temporary password has been set. Use it to sign in and change your password.</p>
  
  <div style="border: 1px solid #ddd; padding: 12px; margin: 16px 0; background-color: #f9f9f9;">
    <p style="margin: 0 0 8px 0;"><strong>Shop Code:</strong> <span style="font-size: 18px; font-weight: bold;">${displayShopCode}</span></p>
    <p style="margin: 0;"><strong>Temporary Password:</strong> <span style="font-size: 18px; font-weight: bold;">${tempPassword}</span></p>
  </div>
  
  <p><strong>Login URL:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
  
  <p>This password expires in 60 minutes.</p>
</body>
</html>`;

        const result = await sendEmail({
          to: toEmail,
          subject,
          text,
          html,
          accountId,
        });

        emailSent = true;
        console.log("[ResetPw] sendEmail success", {
          to: toEmail,
          accountId: String(accountId),
          shopCode,
          messageId: result.messageId,
        });
      } catch (err: unknown) {
        emailSent = false;
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        emailError = "Reset password email could not be sent. Please copy the temporary password and share it with the team member.";
        console.error("[ResetPw] sendEmail failed", {
          to: toEmail,
          accountId: String(accountId),
          shopCode,
          err: errorMessage,
        });
      }

      const expiresAt = tempPasswordExpiresAt.toISOString();

      return res.status(200).json({
        ok: true,
        tempPassword,
        shopCode,
        expiresAt,
        emailSent,
        ...(emailError ? { emailError } : {}),
      });
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
  requireBillingActive,
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

      // Fetch Account.slug for shopCode
      const account = await Account.findById(accountId).select("slug").lean();
      const shopCode = account?.slug || null;
      const displayShopCode = shopCode || "(not available)";

      // Send reactivation email
      const toEmail = (user.email || "").trim();
      let emailSent = false;
      let emailError: string | undefined = undefined;

      if (!toEmail || !toEmail.includes("@")) {
        emailSent = false;
        emailError = "User has no valid email address. Please share credentials manually.";
      } else {
        try {
          const loginUrl = getTenantLoginUrl();
          const subject = "Your account has been reactivated";
          const text = `Your Caruso Service Manager account has been reactivated.\n\n` +
            `Shop Code: ${displayShopCode}\n` +
            `Temporary password: ${tempPassword}\n` +
            `Email: ${toEmail}\n` +
            `Login URL: ${loginUrl}\n\n` +
            `Please sign in and change your password.`;

          const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <p>Your Caruso Service Manager account has been reactivated.</p>
  
  <div style="border: 1px solid #ddd; padding: 12px; margin: 16px 0; background-color: #f9f9f9;">
    <p style="margin: 0 0 8px 0;"><strong>Shop Code:</strong> <span style="font-size: 18px; font-weight: bold;">${displayShopCode}</span></p>
    <p style="margin: 0;"><strong>Temporary Password:</strong> <span style="font-size: 18px; font-weight: bold;">${tempPassword}</span></p>
  </div>
  
  <p><strong>Email:</strong> ${toEmail}</p>
  <p><strong>Login URL:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
  
  <p>Please sign in and change your password.</p>
</body>
</html>`;

          const result = await sendEmail({
            to: toEmail,
            subject,
            text,
            html,
            accountId,
          });

          emailSent = true;
          console.log("[Reactivate] sendEmail success", {
            to: toEmail,
            accountId: String(accountId),
            shopCode,
            messageId: result.messageId,
          });
        } catch (err: unknown) {
          emailSent = false;
          const errorMessage = err instanceof Error ? err.message : "Unknown error";
          emailError = "Reactivation email could not be sent. Please copy the temporary password and share it with the team member.";
          console.error("[Reactivate] sendEmail failed", {
            to: toEmail,
            accountId: String(accountId),
            shopCode,
            err: errorMessage,
          });
        }
      }

      return res.json({
        tempPassword,
        shopCode,
        emailSent,
        ...(emailError ? { emailError } : {}),
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/users/:id/role
 * Owner-only: change a user's role (manager/technician only)
 */
router.patch(
  "/:id/role",
  requireBillingActive,
  requireRole(["owner"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = (req as any).accountId;
      const actor = (req as any).actor;
      const { id } = req.params;
      const { role: newRole } = req.body;

      if (!accountId || !actor?._id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!newRole || (newRole !== "manager" && newRole !== "technician")) {
        return res.status(400).json({ message: "role must be 'manager' or 'technician'" });
      }

      // Find user scoped by accountId
      const user = await User.findOne({
        _id: id,
        accountId,
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Cannot change role for owners
      if (user.role === "owner") {
        return res.status(403).json({ message: "Cannot change role for owner accounts" });
      }

      const oldRole = user.role;

      // If role unchanged, return early without sending email
      if (oldRole === newRole) {
        return res.json({
          ok: true,
          changed: false,
          emailSent: false,
        });
      }

      // Update role
      user.role = newRole;
      await user.save();

      console.log("[TENANT_ROLE_CHANGE] ok", {
        userId: id,
        to: user.email,
        oldRole,
        newRole,
        accountId: String(accountId),
      });

      // Fetch Account.slug for shopCode
      const account = await Account.findById(accountId).select("slug").lean();
      const shopCode = account?.slug || null;
      const displayShopCode = shopCode || "(not available)";

      // Send role-change email
      const toEmail = user.email;
      let emailSent = false;
      let emailError: string | undefined = undefined;

      try {
        const loginUrl = getTenantLoginUrl();
        const subject = "Your role has been updated";
        const text = `Your role in Caruso Service Manager has been changed.\n\n` +
          `Shop Code: ${displayShopCode}\n` +
          `Previous Role: ${oldRole}\n` +
          `New Role: ${newRole}\n` +
          `Email: ${toEmail}\n` +
          `Login URL: ${loginUrl}\n\n` +
          `Please sign in to access your updated permissions.`;

        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <p>Your role in Caruso Service Manager has been changed.</p>
  
  <div style="border: 1px solid #ddd; padding: 12px; margin: 16px 0; background-color: #f9f9f9;">
    <p style="margin: 0 0 8px 0;"><strong>Shop Code:</strong> <span style="font-size: 18px; font-weight: bold;">${displayShopCode}</span></p>
    <p style="margin: 0;"><strong>New Role:</strong> <span style="font-size: 18px; font-weight: bold;">${newRole}</span></p>
  </div>
  
  <p><strong>Previous Role:</strong> ${oldRole}</p>
  <p><strong>Email:</strong> ${toEmail}</p>
  <p><strong>Login URL:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
  
  <p>Please sign in to access your updated permissions.</p>
</body>
</html>`;

        const result = await sendEmail({
          to: toEmail,
          subject,
          text,
          html,
          accountId,
        });

        emailSent = true;
        console.log("[TENANT_ROLE_CHANGE_EMAIL] sent", {
          to: toEmail,
          accountId: String(accountId),
          shopCode,
          oldRole,
          newRole,
          messageId: result.messageId,
        });
      } catch (err: unknown) {
        emailSent = false;
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        emailError = "Role change email could not be sent. Please notify the team member manually.";
        console.error("[TENANT_ROLE_CHANGE_EMAIL] failed", {
          to: toEmail,
          accountId: String(accountId),
          shopCode,
          oldRole,
          newRole,
          err: errorMessage,
        });
      }

      return res.json({
        ok: true,
        changed: true,
        emailSent,
        ...(emailError ? { emailError } : {}),
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
