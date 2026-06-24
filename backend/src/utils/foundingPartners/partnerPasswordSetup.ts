import jwt, { type SignOptions } from "jsonwebtoken";

const SETUP_TOKEN_EXPIRY = process.env.PARTNER_SETUP_TOKEN_EXPIRY || "15m";
const PORTAL_TOKEN_EXPIRY = process.env.AUTH_TOKEN_EXPIRY || "7d";

export interface PartnerSetupTokenPayload {
  purpose: "partner_password_setup";
  partnerUserId: string;
  foundingPartnerId: string;
  accountId: string;
  sv: number;
}

export interface PartnerPortalTokenPayload {
  partnerUserId: string;
  foundingPartnerId: string;
  role: "founding_partner";
  accountId: string;
  sv: number;
}

function getAuthSecret(): string {
  const secret = process.env.AUTH_TOKEN_SECRET;
  if (!secret || typeof secret !== "string") {
    throw new Error("AUTH_TOKEN_SECRET not configured");
  }
  return secret;
}

export function signPartnerPasswordSetupToken(params: {
  partnerUserId: string;
  foundingPartnerId: string;
  accountId: string;
  sv: number;
}): string {
  const payload: PartnerSetupTokenPayload = {
    purpose: "partner_password_setup",
    partnerUserId: params.partnerUserId,
    foundingPartnerId: params.foundingPartnerId,
    accountId: params.accountId,
    sv: params.sv,
  };
  return jwt.sign(payload, getAuthSecret(), { expiresIn: SETUP_TOKEN_EXPIRY } as SignOptions);
}

export function verifyPartnerPasswordSetupToken(token: string): PartnerSetupTokenPayload {
  const decoded = jwt.verify(token, getAuthSecret()) as PartnerSetupTokenPayload;
  if (decoded?.purpose !== "partner_password_setup") {
    throw new Error("INVALID_SETUP_TOKEN");
  }
  if (
    !decoded.partnerUserId ||
    !decoded.foundingPartnerId ||
    !decoded.accountId ||
    typeof decoded.sv !== "number"
  ) {
    throw new Error("INVALID_SETUP_TOKEN");
  }
  return decoded;
}

export function signPartnerPortalToken(params: {
  partnerUserId: string;
  foundingPartnerId: string;
  accountId: string;
  sv: number;
}): string {
  const payload: PartnerPortalTokenPayload = {
    partnerUserId: params.partnerUserId,
    foundingPartnerId: params.foundingPartnerId,
    role: "founding_partner",
    accountId: params.accountId,
    sv: params.sv,
  };
  return jwt.sign(payload, getAuthSecret(), { expiresIn: PORTAL_TOKEN_EXPIRY } as SignOptions);
}

/**
 * Partner portal password rules (stricter than tenant change-password).
 */
export function validatePartnerPortalPassword(password: string, email: string): string[] {
  const errors: string[] = [];
  const p = password ?? "";

  if (p.length < 12) {
    errors.push("Password must be at least 12 characters");
    return errors;
  }

  if (!/[a-z]/.test(p)) {
    errors.push("Password must include at least one lowercase letter");
  }
  if (!/[A-Z]/.test(p)) {
    errors.push("Password must include at least one uppercase letter");
  }
  if (!/[0-9]/.test(p)) {
    errors.push("Password must include at least one number");
  }
  if (!/[^a-zA-Z0-9]/.test(p)) {
    errors.push("Password must include at least one symbol");
  }

  const localPart = String(email).split("@")[0]?.toLowerCase().trim();
  if (localPart && localPart.length >= 2 && p.toLowerCase().includes(localPart)) {
    errors.push("Password must not contain your email username");
  }

  return errors;
}
