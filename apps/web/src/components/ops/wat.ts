/**
 * West Africa Time (WAT, UTC+1) helpers for the OPS vertical.
 *
 * SPEC §7 time-zone rule: timestamps are STORED in UTC, but "due today",
 * "this week" and rendering are computed in WAT. WAT has no DST, so it is a
 * fixed +1h offset from UTC — we can compute calendar-day boundaries by
 * shifting a UTC instant into WAT, reading its civil date, then shifting back.
 *
 * No shared dependency is added (SPEC: "don't add shared deps"); this is plain
 * Date arithmetic.
 */

/** WAT is a fixed UTC+1 offset (no daylight saving). */
export const WAT_OFFSET_MS = 60 * 60 * 1000;

/**
 * The civil (year/month/day) date in WAT for a given UTC instant, returned as
 * its parts. Used to bucket reminders by WAT calendar day.
 */
export function watParts(instant: Date): { year: number; month: number; day: number } {
  const shifted = new Date(instant.getTime() + WAT_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
}

/**
 * The UTC instant corresponding to 00:00 WAT on the WAT calendar day that
 * contains `instant`. (i.e. start of "today" in WAT, expressed in UTC.)
 */
export function watStartOfDay(instant: Date): Date {
  const { year, month, day } = watParts(instant);
  // 00:00 WAT == (00:00 - 1h) UTC == 23:00 UTC the previous day.
  const utcMidnightOfWatDay = Date.UTC(year, month, day, 0, 0, 0, 0);
  return new Date(utcMidnightOfWatDay - WAT_OFFSET_MS);
}

/** The UTC instant for 00:00 WAT of the day AFTER `instant`'s WAT day. */
export function watStartOfNextDay(instant: Date): Date {
  const start = watStartOfDay(instant);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * Start of the current WAT week (Monday 00:00 WAT) as a UTC instant, plus the
 * exclusive end (next Monday 00:00 WAT). Used by the KPI "completed jobs this
 * week" auto-computation.
 */
export function watCurrentWeekRange(now: Date = new Date()): { start: Date; end: Date } {
  const todayStart = watStartOfDay(now);
  // Determine WAT weekday (0=Sun..6=Sat) for the WAT day.
  const shifted = new Date(now.getTime() + WAT_OFFSET_MS);
  const watWeekday = shifted.getUTCDay();
  // Days since Monday (treat Monday as the first day of the week).
  const daysSinceMonday = (watWeekday + 6) % 7;
  const start = new Date(todayStart.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { start, end };
}

/** Classifies a reminder due-instant relative to `now`, in WAT calendar days. */
export type DueBucket = "overdue" | "today" | "upcoming";

export function bucketByDueAt(dueAt: Date, now: Date = new Date()): DueBucket {
  const todayStart = watStartOfDay(now);
  const tomorrowStart = watStartOfNextDay(now);
  if (dueAt.getTime() < todayStart.getTime()) return "overdue";
  if (dueAt.getTime() < tomorrowStart.getTime()) return "today";
  return "upcoming";
}

/** Renders a UTC instant as a short WAT date+time string (English, 24h). */
export function formatWat(instant: Date | string): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** Renders just the WAT calendar date (no time). */
export function formatWatDate(instant: Date | string): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(d);
}

/**
 * Converts a UTC instant to the `YYYY-MM-DDTHH:mm` string that a
 * `datetime-local` input expects, expressed in WAT wall-clock.
 */
export function toWatLocalInput(instant: Date | string): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  const shifted = new Date(d.getTime() + WAT_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}` +
    `T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`
  );
}

/**
 * Parses a `datetime-local` value (interpreted as WAT wall-clock) into the
 * corresponding UTC `Date`. Inverse of {@link toWatLocalInput}.
 */
export function fromWatLocalInput(value: string): Date {
  // value: "YYYY-MM-DDTHH:mm"
  const [datePart, timePart = "00:00"] = value.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  const asUtc = Date.UTC(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
  return new Date(asUtc - WAT_OFFSET_MS);
}
