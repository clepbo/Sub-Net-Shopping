// Benin City runs on West Africa Time (UTC+1, no daylight saving), so all
// store schedules are interpreted in Africa/Lagos regardless of server TZ.
export const TIMEZONE = "Africa/Lagos";
const LAGOS_OFFSET_MINUTES = 60;

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/** Day of week (0 = Sunday) and minutes since midnight, in Lagos time. */
export function lagosClock(now: Date): { dayOfWeek: number; minutes: number } {
  const shifted = new Date(now.getTime() + LAGOS_OFFSET_MINUTES * 60_000);
  return { dayOfWeek: shifted.getUTCDay(), minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes() };
}

/** "HH:MM" → minutes since midnight. */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** The instant at "HH:MM" Lagos time on the same Lagos calendar day as `now`. */
export function lagosTimeToday(now: Date, hhmm: string): Date {
  const shifted = new Date(now.getTime() + LAGOS_OFFSET_MINUTES * 60_000);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() + (toMinutes(hhmm) - LAGOS_OFFSET_MINUTES) * 60_000);
}

/** "14:30" → "2:30 PM" */
export function formatClock(hhmm: string): string {
  const mins = toMinutes(hhmm);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

const upperMeridiem = (s: string) => s.replace(/\b(am|pm)\b/, (m) => m.toUpperCase());

/** A Date shown as Lagos wall-clock time, e.g. "6:00 PM". */
export function formatInstant(date: Date): string {
  return upperMeridiem(
    new Intl.DateTimeFormat("en-NG", { timeZone: TIMEZONE, hour: "numeric", minute: "2-digit", hour12: true }).format(date),
  );
}

export function formatDateTime(date: Date): string {
  return upperMeridiem(
    new Intl.DateTimeFormat("en-NG", {
      timeZone: TIMEZONE,
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date),
  );
}
