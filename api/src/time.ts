// Everything about "what day is it for the user". No fixed offsets anywhere:
// the Intl database knows the daylight-saving rules of every IANA zone.

const MS_PER_DAY = 86_400_000;

const dayFormatters = new Map<string, Intl.DateTimeFormat>();

/** The calendar day (`YYYY-MM-DD`) that `instant` falls on in `timeZone`. */
export function localDay(instant: Date, timeZone: string): string {
  let formatter = dayFormatters.get(timeZone);
  if (!formatter) {
    // The "en-CA" locale prints dates as YYYY-MM-DD.
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dayFormatters.set(timeZone, formatter);
  }
  return formatter.format(instant);
}

/** True for real IANA zone names such as "Europe/Bucharest" (not "+03:00"). */
export function isValidTimeZone(value: unknown): value is string {
  // The pattern rejects offsets like "+03:00", which Intl would otherwise accept.
  if (typeof value !== "string" || !/^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)*$/.test(value)) {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** Parses an ISO 8601 timestamp that carries an offset (the X-Now header). */
export function parseInstant(text: string): Date | null {
  if (!ISO_WITH_OFFSET.test(text)) return null;
  const instant = new Date(text);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

/** UTC timestamp without milliseconds: `2026-10-05T06:15:00Z`. */
export function toUtcIso(instant: Date): string {
  return instant.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** True for a real calendar date written as `YYYY-MM-DD` (rejects 2026-02-30). */
export function isValidDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

/** Days since 1970-01-01 for a `YYYY-MM-DD` string; consecutive days differ by 1. */
export function dayNumber(day: string): number {
  return Date.parse(`${day}T00:00:00Z`) / MS_PER_DAY;
}
