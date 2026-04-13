// frontend/src/utils/dateTime.ts

/** Format date as YYYY-MM-DD for API */
export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Format time as HH:mm for API (startAt is full ISO, but we need time part for inputs) */
export function toTimeString(d: Date): string {
  return d.toISOString().slice(11, 16);
}

/** Format date as YYYY-MM-DD in local timezone (for form inputs) */
export function toISODateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Format time as HH:mm in local timezone (for form inputs) */
export function toTimeStringLocal(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${min}`;
}

/** Parse YYYY-MM-DD and HH:mm into a Date (local timezone) */
export function parseDateAndTime(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, h ?? 0, min ?? 0, 0, 0);
}

/** Format time for display (e.g. "9:00 AM") */
export function formatTimeDisplay(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Format date for display */
export function formatDateDisplay(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/**
 * Show the local calendar day for a scheduled start instant.
 * Prefer this over `scheduledDate` from the API when displaying on a work order:
 * `scheduledDate` is often stored as UTC midnight and can shift one day in local time.
 */
export function formatScheduleLocalDayFromStartAt(isoStartAt: string): string {
  const d = new Date(isoStartAt);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/** Format time range for display (e.g. "9:00 AM – 10:30 AM") */
export function formatTimeRangeDisplay(startIso: string, endIso: string): string {
  const start = formatTimeDisplay(startIso);
  const end = formatTimeDisplay(endIso);
  return `${start} – ${end}`;
}
