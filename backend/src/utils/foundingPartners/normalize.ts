/** Normalize phone to digits only for duplicate comparison. */
export function normalizePhone(phone: string | undefined | null): string | undefined {
  if (phone == null) return undefined;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 ? digits : undefined;
}

/** Normalize email for duplicate comparison. */
export function normalizeEmail(email: string | undefined | null): string | undefined {
  if (email == null) return undefined;
  const trimmed = email.trim().toLowerCase();
  return trimmed === "" ? undefined : trimmed;
}

/** Extract hostname from website URL for duplicate comparison. */
export function normalizeWebsiteHost(website: string | undefined | null): string | undefined {
  if (website == null) return undefined;
  let raw = website.trim().toLowerCase();
  if (raw === "") return undefined;
  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }
  try {
    const host = new URL(raw).hostname.replace(/^www\./, "");
    return host === "" ? undefined : host;
  } catch {
    const fallback = raw.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    return fallback === "" ? undefined : fallback;
  }
}

/** Normalize business name for fuzzy comparison. */
export function normalizeBusinessName(name: string | undefined | null): string | undefined {
  if (name == null) return undefined;
  const trimmed = name.trim().toLowerCase().replace(/\s+/g, " ");
  return trimmed === "" ? undefined : trimmed;
}
