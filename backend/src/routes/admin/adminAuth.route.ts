import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { User } from "../../models/user.model";
import { getSystemAccount } from "../../utils/getSystemAccount";
import { trackAdminAudit } from "../../utils/trackAdminAudit";

const router = Router();

/**
 * POST /api/admin/auth/change-password
 * Body: { currentPassword: string, newPassword: string }
 * Requires admin token (requireAdminAuth on /api/admin).
 */
router.post("/change-password", async (req: Request, res: Response) => {
  try {
    const adminActor = (req as any).adminActor;
    if (!adminActor?._id) return res.status(401).json({ message: "Unauthorized" });

    const systemAccount = await getSystemAccount();
    if (!systemAccount) return res.status(500).json({ message: "System account not configured" });

    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
    if (currentPassword == null || typeof currentPassword !== "string") {
      return res.status(400).json({ message: "currentPassword is required" });
    }
    if (newPassword == null || typeof newPassword !== "string") {
      return res.status(400).json({ message: "newPassword is required" });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const user = await User.findOne({ _id: adminActor._id });
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (user.role !== "admin" && user.role !== "superadmin") return res.status(403).json({ message: "Forbidden" });

    const match = await bcrypt.compare(currentPassword, user.passwordHash || "");
    if (!match) return res.status(401).json({ message: "Current password is incorrect" });

    const saltRounds = Number(process.env.BCRYPT_ROUNDS) || 10;
    user.passwordHash = await bcrypt.hash(newPassword, saltRounds);
    await user.save();

    await trackAdminAudit({
      adminId: adminActor._id,
      action: "ADMIN_PASSWORD_CHANGED",
      targetAccountId: systemAccount._id,
      before: undefined,
      after: { userId: user._id.toString(), email: user.email },
      note: "self-service password change",
      ip: (req as any).auditContext?.ip,
      userAgent: (req as any).auditContext?.userAgent,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[AdminChangePw] error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
