// src/utils/weekRange.ts
export function getThisWeekRangeMondayBased(now = new Date()) {
  // Local time (matches how the user experiences “this week”)
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  // JS: Sun=0, Mon=1 ... Sat=6
  const day = start.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day; // if Sunday, go back 6 days
  start.setDate(start.getDate() + diffToMonday);

  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  end.setMilliseconds(end.getMilliseconds() - 1); // Sun 23:59:59.999

  return { start, end };
}

export function isDateInRangeInclusive(d: Date, start: Date, end: Date) {
  const t = d.getTime();
  return t >= start.getTime() && t <= end.getTime();
}
