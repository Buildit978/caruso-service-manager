import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { FoundingPartner } from "../../models/foundingPartner.model";
import { User } from "../../models/user.model";
import { getSystemAccount } from "../../utils/getSystemAccount";
import {
  signPartnerPasswordSetupToken,
  signPartnerPortalToken,
  validatePartnerPortalPassword,
  verifyPartnerPasswordSetupToken,
} from "../../utils/foundingPartners/partnerPasswordSetup";
import { loginLimiter } from "../auth.routes";

const router = Router();

/**
 * POST /api/partner/auth/login (public)
 * Body: { email, password }
 * When mustChangePassword: returns passwordSetupToken only (no portal session).
 * Otherwise: JWT partner session.
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

    const partnerSummary = {
      id: partner._id.toString(),
      name: partner.name,
      email: partner.email,
    };

    const sv = user.sessionVersion ?? 0;
    const accountId = systemAccount._id.toString();

    if (user.mustChangePassword === true) {
      const passwordSetupToken = signPartnerPasswordSetupToken({
        partnerUserId: user._id.toString(),
        foundingPartnerId: partner._id.toString(),
        accountId,
        sv,
      });

      return res.json({
        mustChangePassword: true,
        passwordSetupToken,
        partner: partnerSummary,
      });
    }

    const loginAt = new Date();
    await FoundingPartner.updateOne({ _id: partner._id }, { $set: { lastPortalLoginAt: loginAt } });

    const token = signPartnerPortalToken({
      partnerUserId: user._id.toString(),
      foundingPartnerId: partner._id.toString(),
      accountId,
      sv,
    });

    return res.json({
      token,
      partner: partnerSummary,
      mustChangePassword: false,
    });
  } catch (err) {
    console.error("[PartnerAuthLogin] error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * POST /api/partner/auth/set-password (public)
 * Header: x-partner-setup-token
 * Body: { newPassword }
 * Completes invite-only first login; returns normal partner portal token.
 */
router.post("/set-password", loginLimiter, async (req: Request, res: Response) => {
  try {
    const setupTokenRaw =
      (typeof req.header("x-partner-setup-token") === "string"
        ? req.header("x-partner-setup-token")
        : null) ||
      (typeof req.body?.passwordSetupToken === "string" ? req.body.passwordSetupToken : null);

    if (!setupTokenRaw?.trim()) {
      return res.status(401).json({ message: "Password setup session expired. Sign in again." });
    }

    const newPassword = req.body?.newPassword as string | undefined;
    if (!newPassword || typeof newPassword !== "string") {
      return res.status(400).json({ message: "newPassword is required" });
    }

    let decoded;
    try {
      decoded = verifyPartnerPasswordSetupToken(setupTokenRaw.trim());
    } catch {
      return res.status(401).json({ message: "Password setup session expired. Sign in again." });
    }

    const systemAccount = await getSystemAccount();
    if (!systemAccount || String(systemAccount._id) !== decoded.accountId) {
      return res.status(401).json({ message: "Password setup session expired. Sign in again." });
    }

    if (
      !Types.ObjectId.isValid(decoded.partnerUserId) ||
      !Types.ObjectId.isValid(decoded.foundingPartnerId)
    ) {
      return res.status(401).json({ message: "Password setup session expired. Sign in again." });
    }

    const user = await User.findOne({
      _id: new Types.ObjectId(decoded.partnerUserId),
      accountId: systemAccount._id,
      role: "founding_partner",
      isActive: true,
    });

    if (!user || user.mustChangePassword !== true) {
      return res.status(401).json({ message: "Password setup session expired. Sign in again." });
    }

    const tokenSv = decoded.sv;
    const userSv = user.sessionVersion ?? 0;
    if (tokenSv !== userSv) {
      return res.status(401).json({ message: "Password setup session expired. Sign in again." });
    }

    const partner = await FoundingPartner.findOne({
      _id: new Types.ObjectId(decoded.foundingPartnerId),
      userId: user._id,
      status: "active",
    }).lean();

    if (!partner) {
      return res.status(403).json({ message: "Partner access unavailable" });
    }

    const validationErrors = validatePartnerPortalPassword(newPassword, user.email);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: validationErrors.join(" "),
        errors: validationErrors,
      });
    }

    const matchesTemp = await bcrypt.compare(newPassword, user.passwordHash || "");
    if (matchesTemp) {
      return res.status(400).json({
        message: "New password must be different from your temporary invite password.",
      });
    }

    const saltRounds = Number(process.env.BCRYPT_ROUNDS) || 10;
    user.passwordHash = await bcrypt.hash(newPassword, saltRounds);
    user.mustChangePassword = false;
    user.tempPasswordExpiresAt = null;
    user.tokenInvalidBefore = new Date();
    user.sessionVersion = (user.sessionVersion ?? 0) + 1;
    await user.save();

    const loginAt = new Date();
    await FoundingPartner.updateOne({ _id: partner._id }, { $set: { lastPortalLoginAt: loginAt } });

    const token = signPartnerPortalToken({
      partnerUserId: user._id.toString(),
      foundingPartnerId: partner._id.toString(),
      accountId: systemAccount._id.toString(),
      sv: user.sessionVersion ?? 0,
    });

    return res.json({
      ok: true,
      token,
      mustChangePassword: false,
      partner: {
        id: partner._id.toString(),
        name: partner.name,
        email: partner.email,
      },
    });
  } catch (err) {
    console.error("[PartnerSetPassword] error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
