import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { User } from "../../models/user.model";
import { getSystemAccount } from "../../utils/getSystemAccount";
import { loginLimiter } from "../auth.routes";

const router = Router();

/**
 * POST /api/admin/auth/login (public)
 * Body: { email, password }
 * Same User model as /api/admin/admin-users. System account (slug "system") only.
 * JWT payload: adminUserId, role, accountId. Returns { token, adminUser }.
 */
router.post("/login", loginLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const systemAccount = await getSystemAccount();
    if (!systemAccount) {
      return res.status(500).json({ message: "System account not configured" });
    }

    const emailNorm = String(email).toLowerCase().trim();
    const user = await User.findOne({
      email: emailNorm,
      isActive: true,
      role: { $in: ["admin", "superadmin"] },
      accountId: systemAccount._id,
    })
      .select("+passwordHash")
      .lean();

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const passwordMatch = await bcrypt.compare(String(password), user.passwordHash || "");
    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const secret = process.env.AUTH_TOKEN_SECRET;
    if (!secret || typeof secret !== "string") {
      return res.status(500).json({ message: "Server auth misconfigured" });
    }

    const tokenExpiry = process.env.AUTH_TOKEN_EXPIRY || "7d";
    const payload = {
      adminUserId: user._id.toString(),
      role: user.role,
      accountId: user.accountId.toString(),
    };
    const token = jwt.sign(payload, secret, { expiresIn: tokenExpiry } as SignOptions);

    return res.json({
      token,
      adminUser: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        accountId: user.accountId.toString(),
      },
    });
  } catch (err) {
    console.error("[AdminAuthLogin] error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
