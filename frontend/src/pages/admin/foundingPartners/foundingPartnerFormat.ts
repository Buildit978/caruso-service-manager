export const FP_MODULE_TITLE = "Founding Partner Program";

export function formatDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export function formatDateTime(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export function formatWebsiteHref(website: string | undefined | null): string | null {
  if (!website?.trim()) return null;
  const raw = website.trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

export function formatWebsiteLabel(website: string | undefined | null): string {
  if (!website?.trim()) return "—";
  return website.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: string }).message);
  }
  return fallback;
}

export function toDatetimeLocalValue(iso: string | undefined | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

export function apiErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  const data = err && typeof err === "object" && "data" in err ? (err as { data?: { message?: string } }).data : undefined;
  if (data?.message) return data.message;
  return errorMessage(err, fallback);
}
