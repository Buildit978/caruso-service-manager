export type DateParseResult = { ok: true; date: Date } | { ok: false; error: string };

export type OptionalDateParseResult =
  | { ok: true; date: Date | undefined }
  | { ok: false; error: string };

export function startOfTodayLocal(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
}

export function normalizeToLocalNoon(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

export function isAfterToday(date: Date): boolean {
  return normalizeToLocalNoon(date).getTime() > startOfTodayLocal().getTime();
}

export function parseDateOnlyInput(value: string | undefined | null): DateParseResult {
  if (value == null || String(value).trim() === "") {
    return { ok: false, error: "Invalid date" };
  }

  const trimmed = String(value).trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnly) {
    const d = new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3]),
      12,
      0,
      0,
      0
    );
    if (Number.isNaN(d.getTime())) return { ok: false, error: "Invalid date" };
    return { ok: true, date: d };
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return { ok: false, error: "Invalid date" };
  return { ok: true, date: normalizeToLocalNoon(parsed) };
}

export function parseActivityDateInput(
  value: string | undefined | null,
  defaultToToday = true
): DateParseResult {
  if (value == null || String(value).trim() === "") {
    if (defaultToToday) return { ok: true, date: startOfTodayLocal() };
    return { ok: false, error: "activityDate is required" };
  }

  const parsed = parseDateOnlyInput(value);
  if (!parsed.ok) return parsed;
  if (isAfterToday(parsed.date)) {
    return { ok: false, error: "Activity date cannot be in the future" };
  }
  return parsed;
}

export type TimeParseResult = { ok: true; time: string } | { ok: false; error: string };

export function currentLocalTimeInputValue(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function parseActivityTimeInput(
  value: string | undefined | null,
  defaultToNow = true
): TimeParseResult {
  if (value == null || String(value).trim() === "") {
    if (defaultToNow) return { ok: true, time: currentLocalTimeInputValue() };
    return { ok: false, error: "activityTime is required" };
  }

  const trimmed = String(value).trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) return { ok: false, error: "Invalid activityTime" };

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return { ok: false, error: "Invalid activityTime" };
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  return { ok: true, time: `${pad(hours)}:${pad(minutes)}` };
}

export function parseOptionalPastOrPresentDateInput(
  value: string | undefined | null,
  fieldLabel: string
): OptionalDateParseResult {
  if (value == null || String(value).trim() === "") {
    return { ok: true, date: undefined };
  }

  const parsed = parseDateOnlyInput(value);
  if (!parsed.ok) return { ok: false, error: `Invalid ${fieldLabel}` };
  if (isAfterToday(parsed.date)) {
    return { ok: false, error: `${fieldLabel} cannot be in the future` };
  }
  return { ok: true, date: parsed.date };
}

export function parseOptionalFollowUpDateInput(value: string | undefined | null): OptionalDateParseResult {
  if (value == null || String(value).trim() === "") {
    return { ok: true, date: undefined };
  }

  const parsed = parseDateOnlyInput(value);
  if (!parsed.ok) return { ok: false, error: "Invalid nextFollowUpDate" };
  return { ok: true, date: parsed.date };
}

export function getEffectiveActivityDate(note: {
  activityDate?: Date | null;
  createdAt?: Date | null;
}): Date | null {
  const raw = note.activityDate ?? note.createdAt;
  if (raw == null) return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseTimeParts(time: string | undefined | null): { hours: number; minutes: number } | null {
  if (!time) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

/** Sortable timestamp: activityDate + activityTime, falling back to createdAt. */
export function getEffectiveActivityTimestamp(note: {
  activityDate?: Date | null;
  activityTime?: string | null;
  createdAt?: Date | null;
}): number | null {
  const baseDate = note.activityDate ?? note.createdAt;
  if (baseDate == null) return null;

  const d = baseDate instanceof Date ? baseDate : new Date(baseDate);
  if (Number.isNaN(d.getTime())) return null;

  const timeParts = parseTimeParts(note.activityTime);
  if (note.activityDate && timeParts) {
    return new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      timeParts.hours,
      timeParts.minutes,
      0,
      0
    ).getTime();
  }

  if (note.activityDate) return normalizeToLocalNoon(d).getTime();
  return d.getTime();
}

export function compareByEffectiveActivityDesc<
  T extends {
    activityDate?: Date | null;
    activityTime?: string | null;
    createdAt?: Date | null;
  },
>(a: T, b: T): number {
  const ta = getEffectiveActivityTimestamp(a);
  const tb = getEffectiveActivityTimestamp(b);
  if (ta == null && tb == null) return 0;
  if (ta == null) return 1;
  if (tb == null) return -1;
  return tb - ta;
}

export function sortNotesByEffectiveActivityDesc<
  T extends {
    activityDate?: Date | null;
    activityTime?: string | null;
    createdAt?: Date | null;
  },
>(notes: T[]): T[] {
  return [...notes].sort(compareByEffectiveActivityDesc);
}
