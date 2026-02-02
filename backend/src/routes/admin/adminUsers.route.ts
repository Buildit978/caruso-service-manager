import { Router, type Request, type Response } from "express";
import { Types } from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../../models/user.model";
import { sendEmail } from "../../utils/email";
import { generateTempPassword } from "../../utils/password";
import { getSystemAccount } from "../../utils/getSystemAccount";
import { trackAdminAudit } from "../../utils/trackAdminAudit";

const router = Router();

const ADMIN_ROLES = ["admin", "superadmin"] as const;
type AdminRole = (typeof ADMIN_ROLES)[number];

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseUserId(param: string | undefined): Types.ObjectId | null {
  if (param == null || param === "" || !Types.ObjectId.isValid(param)) return null;
  return new Types.ObjectId(param);
}

async function setTempPasswordAndInvalidate(user: InstanceType<typeof User>): Promise<string> {
  const tempPassword = generateTempPassword();
  const saltRounds = Number(process.env.BCRYPT_ROUNDS) || 10;
  const passwordHash = await bcrypt.hash(tempPassword, saltRounds);
  user.passwordHash = passwordHash;
  user.tokenInvalidBefore = new Date();
  await user.save();
  return tempPassword;
}

/**
 * POST /api/admin/admin-users/invite
 * Body: { email: string, name?: string, role: "admin" | "superadmin" }
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const adminActor = (req as any).adminActor;
    if (!adminActor?._id) return res.status(401).json({ message: "Unauthorized" });

    const systemAccount = await getSystemAccount();
    if (!systemAccount) return res.status(500).json({ message: "System account not configured" });

    const { email, name, role } = req.body as { email?: string; name?: string; role?: string };
    const emailNorm = email ? String(email).toLowerCase().trim() : "";
    if (!emailNorm || !isValidEmail(emailNorm)) return res.status(400).json({ message: "Valid email is required" });
    if (!role || (role !== "admin" && role !== "superadmin")) return res.status(400).json({ message: "role must be 'admin' or 'superadmin'" });

    const existingUser = await User.findOne({ email: emailNorm });
    if (existingUser) {
      if (existingUser.role !== "admin" && existingUser.role !== "superadmin") {
        return res.status(409).json({ message: "Email already in use" });
      }
      // Reinvite: reset password and email
      const before = { userId: existingUser._id.toString(), email: existingUser.email, role: existingUser.role };
      const tempPassword = await setTempPasswordAndInvalidate(existingUser);
      const displayName = name ? String(name).trim() : existingUser.name;
      if (displayName && displayName !== existingUser.name) {
        existingUser.name = displayName;
        await existingUser.save();
      }
      const subject = "Admin access – sign in";
      const text = `You have been invited to the admin area. Sign in at:\n\n${getAdminLoginUrl()}\n\nEmail: ${emailNorm}\nTemporary password: ${tempPassword}\n\nChange your password after first sign-in if possible.`;
      try {
        await sendEmail({ to: emailNorm, subject, text, from: getAdminFrom() });
      } catch (err: any) {
        console.error("[AdminInvite] sendEmail failed", err?.message);
        return res.status(502).json({ message: "Email not sent" });
      }
      const after = { userId: existingUser._id.toString(), email: existingUser.email, role: existingUser.role };
      await trackAdminAudit({
        adminId: adminActor._id,
        action: "admin.invite.reinvite",
        targetAccountId: systemAccount._id,
        before,
        after,
        note: emailNorm,
        ip: (req as any).auditContext?.ip,
        userAgent: (req as any).auditContext?.userAgent,
      });
      return res.status(200).json({ ok: true, userId: existingUser._id.toString(), reinvite: true });
    }

    const tempPassword = generateTempPassword();
    const saltRounds = Number(process.env.BCRYPT_ROUNDS) || 10;
    const passwordHash = await bcrypt.hash(tempPassword, saltRounds);
    const displayName = name ? String(name).trim() : emailNorm;

    const user = await User.create({
      accountId: systemAccount._id,
      email: emailNorm,
      name: displayName,
      role: role as AdminRole,
      passwordHash,
      isActive: true,
      tokenInvalidBefore: new Date(),
    });

    const subject = "Admin access – sign in";
    const text = `You have been invited to the admin area. Sign in at:\n\n${getAdminLoginUrl()}\n\nEmail: ${emailNorm}\nTemporary password: ${tempPassword}\n\nChange your password after first sign-in if possible.`;
    try {
      await sendEmail({ to: emailNorm, subject, text, from: getAdminFrom() });
    } catch (err: any) {
      console.error("[AdminInvite] sendEmail failed", err?.message);
      return res.status(502).json({ message: "Email not sent" });
    }

    await trackAdminAudit({
      adminId: adminActor._id,
      action: "admin.invite.create",
      targetAccountId: systemAccount._id,
      before: undefined,
      after: { userId: user._id.toString(), email: user.email, role: user.role },
      note: emailNorm,
      ip: (req as any).auditContext?.ip,
      userAgent: (req as any).auditContext?.userAgent,
    });

    return res.status(201).json({ ok: true, userId: user._id.toString() });
  } catch (err) {
    console.error("[AdminInvite] error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * GET /api/admin/admin-users
 * List users with role admin or superadmin.
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const users = await User.find({ role: { $in: ["admin", "superadmin"] } })
      .select("_id email name role createdAt isActive")
      .sort({ createdAt: -1 })
      .lean();

    const items = users.map((u) => ({
      id: u._id.toString(),
      email: u.email,
      name: u.name,
      role: u.role,
      createdAt: (u as any).createdAt ? new Date((u as any).createdAt).toISOString() : undefined,
      isActive: u.isActive,
    }));

    return res.json({ items });
  } catch (err) {
    console.error("[AdminUsers list] error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * POST /api/admin/admin-users/:id/reset-password
 */
router.post("/:id/reset-password", async (req: Request, res: Response) => {
  try {
    const adminActor = (req as any).adminActor;
    if (!adminActor?._id) return res.status(401).json({ message: "Unauthorized" });

    const systemAccount = await getSystemAccount();
    if (!systemAccount) return res.status(500).json({ message: "System account not configured" });

    const userId = parseUserId(req.params.id);
    if (!userId) return res.status(400).json({ message: "Invalid user id" });

    const user = await User.findOne({ _id: userId });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role !== "admin" && user.role !== "superadmin") return res.status(403).json({ message: "Not an admin user" });

    const before = { userId: user._id.toString(), email: user.email, role: user.role };
    const tempPassword = await setTempPasswordAndInvalidate(user);

    const toEmail = (user.email || "").trim();
    if (!toEmail) return res.status(400).json({ message: "User has no email" });
    const subject = "Admin password reset";
    const text = `Your admin password has been reset. Sign in at:\n\n${getAdminLoginUrl()}\n\nEmail: ${toEmail}\nTemporary password: ${tempPassword}`;
    try {
      await sendEmail({ to: toEmail, subject, text, from: getAdminFrom() });
    } catch (err: any) {
      console.error("[AdminResetPw] sendEmail failed", err?.message);
      return res.status(500).json({ message: "Email send failed" });
    }

    const after = { userId: user._id.toString(), email: user.email, role: user.role };
    await trackAdminAudit({
      adminId: adminActor._id,
      action: "admin.reset_password",
      targetAccountId: systemAccount._id,
      before,
      after,
      note: toEmail,
      ip: (req as any).auditContext?.ip,
      userAgent: (req as any).auditContext?.userAgent,
    });

    return res.status(200).json({ ok: true, userId: user._id.toString() });
  } catch (err) {
    console.error("[AdminResetPw] error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * PATCH /api/admin/admin-users/:id/role
 * Body: { role: "admin" | "superadmin" }
 */
router.patch("/:id/role", async (req: Request, res: Response) => {
  try {
    const adminActor = (req as any).adminActor;
    if (!adminActor?._id) return res.status(401).json({ message: "Unauthorized" });

    const systemAccount = await getSystemAccount();
    if (!systemAccount) return res.status(500).json({ message: "System account not configured" });

    const userId = parseUserId(req.params.id);
    if (!userId) return res.status(400).json({ message: "Invalid user id" });

    const { role } = req.body as { role?: string };
    if (!role || (role !== "admin" && role !== "superadmin")) return res.status(400).json({ message: "role must be 'admin' or 'superadmin'" });

    const user = await User.findOne({ _id: userId });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role !== "admin" && user.role !== "superadmin") return res.status(403).json({ message: "Not an admin user" });

    // Disallow demoting the last remaining superadmin
    if (user.role === "superadmin" && role === "admin") {
      const superadminCount = await User.countDocuments({ role: "superadmin", isActive: true });
      if (superadminCount <= 1) return res.status(403).json({ message: "Cannot demote the last superadmin" });
    }

    const before = { userId: user._id.toString(), email: user.email, role: user.role };
    user.role = role as AdminRole;
    await user.save();
    const after = { userId: user._id.toString(), email: user.email, role: user.role };

    await trackAdminAudit({
      adminId: adminActor._id,
      action: "admin.role_change",
      targetAccountId: systemAccount._id,
      before,
      after,
      note: user.email,
      ip: (req as any).auditContext?.ip,
      userAgent: (req as any).auditContext?.userAgent,
    });

    return res.status(200).json({ ok: true, userId: user._id.toString(), role: user.role });
  } catch (err) {
    console.error("[AdminRole] error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

function getAdminLoginUrl(): string {
  const base = process.env.ADMIN_UI_BASE_URL || process.env.FRONTEND_URL || "";
  return base ? `${base.replace(/\/$/, "")}/admin` : "/admin";
}

/** From address for admin invite/reset emails. ADMIN_FROM_EMAIL/ADMIN_FROM_NAME, fallback SMTP_USER. */
function getAdminFrom(): { name: string; email: string } {
  const email = (process.env.ADMIN_FROM_EMAIL || process.env.SMTP_USER || "").trim();
  const name = (process.env.ADMIN_FROM_NAME || "Shop Service Manager Admin").trim();
  return { name, email };
}

export default router;
