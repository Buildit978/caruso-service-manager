/**
 * Partner portal password rules (must match backend validatePartnerPortalPassword).
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

export const PARTNER_PASSWORD_RULES = [
  "At least 12 characters",
  "At least one uppercase letter",
  "At least one lowercase letter",
  "At least one number",
  "At least one symbol",
  "Must not contain your email username",
  "Must be different from your temporary invite password",
] as const;
