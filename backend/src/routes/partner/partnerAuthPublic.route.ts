import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { FoundingPartner } from "../../models/foundingPartner.model";
import { User } from "../../models/user.model";
import { getSystemAccount } from "../../utils/getSystemAccount";
import { loginLimiter } from "../auth.routes";

const router = Router();

/**
 * POST /api/partner/auth/login (public)
 * Body: { email, password }
 * JWT: partnerUserId, foundingPartnerId, role, accountId, sv
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
      accountId: systemAccount._id,
      role: "founding_partner",
      isActive: true,
    }).lean();

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const passwordMatch = await bcrypt.compare(String(password), user.passwordHash || "");
    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.tempPasswordExpiresAt) {
      const now = new Date();
      if (now > new Date(user.tempPasswordExpiresAt)) {
        return res.status(401).json({
          message: "Temporary password has expired. Please request a new password reset.",
          code: "TEMP_PASSWORD_EXPIRED",
        });
      }
    }

    const partner = await FoundingPartner.findOne({ userId: user._id }).lean();
    if (!partner || partner.status !== "active") {
      return res.status(403).json({ message: "Partner access unavailable" });
    }

    const loginAt = new Date();
    await FoundingPartner.updateOne({ _id: partner._id }, { $set: { lastPortalLoginAt: loginAt } });

    const secret = process.env.AUTH_TOKEN_SECRET;
    if (!secret || typeof secret !== "string") {
      return res.status(500).json({ message: "Server auth misconfigured" });
    }

    const tokenExpiry = process.env.AUTH_TOKEN_EXPIRY || "7d";
    const sv = user.sessionVersion ?? 0;
    const payload = {
      partnerUserId: user._id.toString(),
      foundingPartnerId: partner._id.toString(),
      role: "founding_partner" as const,
      accountId: systemAccount._id.toString(),
      sv,
    };
    const token = jwt.sign(payload, secret, { expiresIn: tokenExpiry } as SignOptions);

    return res.json({
      token,
      partner: {
        id: partner._id.toString(),
        name: partner.name,
        email: partner.email,
      },
      mustChangePassword: user.mustChangePassword === true,
    });
  } catch (err) {
    console.error("[PartnerAuthLogin] error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
