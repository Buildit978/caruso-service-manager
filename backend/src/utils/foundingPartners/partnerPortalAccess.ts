import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { FoundingPartner, type IFoundingPartner } from "../../models/foundingPartner.model";
import { User } from "../../models/user.model";
import { getSystemAccount } from "../getSystemAccount";
import { generateTempPassword } from "../password";
import { sendEmail } from "../email";

export type PortalAccessStatus = "enabled" | "disabled";

export interface PortalAccessSnapshot {
  status: PortalAccessStatus;
  enabledAt?: string;
  disabledAt?: string;
  lastLoginAt?: string;
}

export class PartnerPortalAccessError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
    this.name = "PartnerPortalAccessError";
  }
}

function toIso(date: Date | undefined | null): string | undefined {
  if (date == null) return undefined;
  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function getPartnerPortalLoginUrl(): string {
  const base = process.env.FRONTEND_URL || process.env.ADMIN_UI_BASE_URL || "";
  return base ? `${base.replace(/\/$/, "")}/partner` : "/partner";
}

function getPortalFrom(): { name: string; email: string } {
  const email = (process.env.ADMIN_FROM_EMAIL || process.env.SMTP_USER || "").trim();
  const name = (process.env.ADMIN_FROM_NAME || "Shop Service Manager").trim();
  return { name, email };
}

async function sendPartnerPortalInviteEmail(email: string, tempPassword: string): Promise<void> {
  const subject = "Partner portal access";
  const text = `You have been invited to the partner portal. Access is by invitation only.\n\nSign in at:\n${getPartnerPortalLoginUrl()}/login\n\nEmail: ${email}\nTemporary password: ${tempPassword}\n\nYou will be asked to create a secure permanent password on first sign-in.`;
  await sendEmail({ to: email, subject, text, from: getPortalFrom() });
}

async function applyTempPassword(user: InstanceType<typeof User>): Promise<string> {
  const tempPassword = generateTempPassword();
  const saltRounds = Number(process.env.BCRYPT_ROUNDS) || 10;
  user.passwordHash = await bcrypt.hash(tempPassword, saltRounds);
  user.mustChangePassword = true;
  user.tokenInvalidBefore = new Date();
  user.sessionVersion = (user.sessionVersion ?? 0) + 1;
  await user.save();
  return tempPassword;
}

async function invalidateUserSessions(user: InstanceType<typeof User>): Promise<void> {
  user.tokenInvalidBefore = new Date();
  user.sessionVersion = (user.sessionVersion ?? 0) + 1;
  await user.save();
}

export async function buildPortalAccessSnapshot(partner: {
  userId?: Types.ObjectId | null;
  portalEnabledAt?: Date | null;
  portalDisabledAt?: Date | null;
  lastPortalLoginAt?: Date | null;
}): Promise<PortalAccessSnapshot> {
  let userActive = false;
  if (partner.userId) {
    const user = await User.findById(partner.userId).select("isActive").lean();
    userActive = user?.isActive === true;
  }

  const status: PortalAccessStatus = partner.userId && userActive ? "enabled" : "disabled";

  return {
    status,
    enabledAt: toIso(partner.portalEnabledAt),
    disabledAt: status === "disabled" ? toIso(partner.portalDisabledAt) : undefined,
    lastLoginAt: toIso(partner.lastPortalLoginAt),
  };
}

async function assertNoConflictingSystemUser(
  email: string,
  systemAccountId: Types.ObjectId,
  excludeUserId?: Types.ObjectId
): Promise<void> {
  const filter: Record<string, unknown> = {
    email,
    accountId: systemAccountId,
    role: { $ne: "founding_partner" },
  };
  if (excludeUserId) {
    filter._id = { $ne: excludeUserId };
  }

  const conflicting = await User.findOne(filter).select("_id role").lean();
  if (conflicting) {
    throw new PartnerPortalAccessError("Email already in use by another account", 409);
  }
}

export async function enablePartnerPortalAccess(
  partnerId: Types.ObjectId
): Promise<{ partner: IFoundingPartner; reusedUser: boolean }> {
  const systemAccount = await getSystemAccount();
  if (!systemAccount) {
    throw new PartnerPortalAccessError("System account not configured", 500);
  }

  const partner = await FoundingPartner.findById(partnerId);
  if (!partner) {
    throw new PartnerPortalAccessError("Partner not found", 404);
  }

  const now = new Date();
  let reusedUser = false;

  if (partner.userId) {
    const linkedUser = await User.findById(partner.userId);
    if (!linkedUser) {
      partner.userId = undefined;
    } else if (linkedUser.role !== "founding_partner") {
      throw new PartnerPortalAccessError("Linked portal user has an invalid role", 409);
    } else if (linkedUser.isActive) {
      throw new PartnerPortalAccessError("Portal access is already enabled", 409);
    } else {
      reusedUser = true;
      linkedUser.email = partner.email;
      linkedUser.name = partner.name;
      linkedUser.isActive = true;
      linkedUser.accountId = systemAccount._id as Types.ObjectId;
      await assertNoConflictingSystemUser(partner.email, systemAccount._id as Types.ObjectId, linkedUser._id as Types.ObjectId);

      const tempPassword = await applyTempPassword(linkedUser);
      try {
        await sendPartnerPortalInviteEmail(partner.email, tempPassword);
      } catch (err: unknown) {
        console.error("[PartnerPortal] enable reinvite sendEmail failed", (err as Error)?.message);
        throw new PartnerPortalAccessError("Email not sent", 502);
      }

      partner.portalEnabledAt = now;
      partner.portalDisabledAt = null;
      await partner.save();
      return { partner, reusedUser };
    }
  }

  await assertNoConflictingSystemUser(partner.email, systemAccount._id as Types.ObjectId);

  const existingPartnerUser = await User.findOne({
    email: partner.email,
    accountId: systemAccount._id,
    role: "founding_partner",
  });

  if (existingPartnerUser) {
    const otherPartner = await FoundingPartner.findOne({
      userId: existingPartnerUser._id,
      _id: { $ne: partner._id },
    }).select("_id").lean();
    if (otherPartner) {
      throw new PartnerPortalAccessError("Email already linked to another partner", 409);
    }
    if (existingPartnerUser.isActive) {
      throw new PartnerPortalAccessError("Portal access is already enabled", 409);
    }

    reusedUser = true;
    existingPartnerUser.name = partner.name;
    existingPartnerUser.isActive = true;
    partner.userId = existingPartnerUser._id as Types.ObjectId;

    const tempPassword = await applyTempPassword(existingPartnerUser);
    try {
      await sendPartnerPortalInviteEmail(partner.email, tempPassword);
    } catch (err: unknown) {
      console.error("[PartnerPortal] enable existing user sendEmail failed", (err as Error)?.message);
      throw new PartnerPortalAccessError("Email not sent", 502);
    }
  } else {
    const tempPassword = generateTempPassword();
    const saltRounds = Number(process.env.BCRYPT_ROUNDS) || 10;
    const passwordHash = await bcrypt.hash(tempPassword, saltRounds);

    const user = await User.create({
      accountId: systemAccount._id,
      email: partner.email,
      name: partner.name,
      role: "founding_partner",
      passwordHash,
      isActive: true,
      mustChangePassword: true,
      tokenInvalidBefore: now,
      sessionVersion: 0,
    });

    partner.userId = user._id as Types.ObjectId;

    try {
      await sendPartnerPortalInviteEmail(partner.email, tempPassword);
    } catch (err: unknown) {
      console.error("[PartnerPortal] enable create sendEmail failed", (err as Error)?.message);
      throw new PartnerPortalAccessError("Email not sent", 502);
    }
  }

  partner.portalEnabledAt = now;
  partner.portalDisabledAt = null;
  await partner.save();

  return { partner, reusedUser };
}

export async function disablePartnerPortalAccess(partnerId: Types.ObjectId): Promise<IFoundingPartner> {
  const partner = await FoundingPartner.findById(partnerId);
  if (!partner) {
    throw new PartnerPortalAccessError("Partner not found", 404);
  }

  if (!partner.userId) {
    throw new PartnerPortalAccessError("Portal access is not enabled", 400);
  }

  const linkedUser = await User.findById(partner.userId);
  if (!linkedUser) {
    throw new PartnerPortalAccessError("Portal access is not enabled", 400);
  }

  if (linkedUser.role !== "founding_partner") {
    throw new PartnerPortalAccessError("Linked portal user has an invalid role", 409);
  }

  if (!linkedUser.isActive) {
    return partner;
  }

  linkedUser.isActive = false;
  await invalidateUserSessions(linkedUser);

  partner.portalDisabledAt = new Date();
  await partner.save();

  return partner;
}
