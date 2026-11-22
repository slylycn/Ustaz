/**
 * All lesson times are entered and shown in Asia/Almaty and stored as UTC (timestamptz).
 * "Date keys" are plain calendar days in Almaty, written "YYYY-MM-DD".
 * No date library: Intl does the time zone math, so this stays correct if offsets ever change.
 */
export const TIME_ZONE = "Asia/Almaty";

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function zonedParts(date: Date) {
  const p: Record<string, string> = {};
  for (const part of partsFormatter.formatToParts(date)) p[part.type] = part.value;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Almaty calendar day of an instant, e.g. "2026-11-23". */
export function zonedDateKey(date: Date): string {
  const p = zonedParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Almaty wall-clock time of an instant, e.g. "14:30". */
export function zonedTime(date: Date): string {
  const p = zonedParts(date);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Today in Almaty. */
export function todayKey(): string {
  return zonedDateKey(new Date());
}

/** Milliseconds Almaty is ahead of UTC at this instant. */
function offsetMs(date: Date): number {
  const p = zonedParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Almaty wall-clock date + time → the real instant. zonedToUtc("2026-11-23", "14:00") → 09:00Z. */
export function zonedToUtc(dateKey: string, time = "00:00"): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = offsetMs(new Date(guess));
  let result = guess - first;
  const second = offsetMs(new Date(result));
  if (second !== first) result = guess - second;
  return new Date(result);
}

export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Monday of the week containing dateKey. */
export function startOfWeek(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDays(dateKey, -((weekday + 6) % 7));
}

export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function isTimeKey(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
