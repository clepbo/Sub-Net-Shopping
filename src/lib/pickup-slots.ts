// Pickup times customers can choose (Reserve & Pick Up). Built from the
// store's opening hours, its pickup window and how long it needs to
// prepare an order, in Benin City time. Pure, so checkout, the server
// check and tests agree.
import { computeAvailability, type StoreSchedule } from "./availability";
import { formatInstant, lagosClock, lagosTimeToday, toMinutes, TIMEZONE } from "./time";

export const SLOT_MINUTES = 30;
/** Today plus the next two days. */
export const SLOT_DAYS = 3;
/** Send the pickup reminder this long before the chosen time. */
export const REMINDER_LEAD_MINUTES = 60;

export type SlotSchedule = StoreSchedule & { pickupPrepMinutes: number };
export type PickupSlot = { iso: string; label: string };
export type SlotDay = { label: string; slots: PickupSlot[] };

function minutesToHHMM(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function dayLabel(offset: number, date: Date) {
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  return new Intl.DateTimeFormat("en-NG", { timeZone: TIMEZONE, weekday: "long", day: "numeric", month: "short" }).format(date);
}

export function pickupSlots(s: SlotSchedule, now: Date = new Date()): SlotDay[] {
  if (!s.pickupEnabled || s.temporarilyClosed) return [];
  const acceptingToday = computeAvailability(s, now).acceptingOrders;
  const earliest = Math.max(now.getTime() + s.pickupPrepMinutes * 60_000, s.pickupPausedUntil?.getTime() ?? 0);
  const days: SlotDay[] = [];

  for (let offset = 0; offset < SLOT_DAYS; offset++) {
    // After today's last order time (or while closed), only later days are offered.
    if (offset === 0 && !acceptingToday) continue;
    const day = new Date(now.getTime() + offset * 86_400_000);
    const row = s.hours.find((h) => h.dayOfWeek === lagosClock(day).dayOfWeek);
    if (!row?.isOpen || !row.opensAt || !row.closesAt) continue;
    const start = Math.max(toMinutes(row.opensAt), s.pickupStart ? toMinutes(s.pickupStart) : 0);
    const end = Math.min(toMinutes(row.closesAt), s.pickupEnd ? toMinutes(s.pickupEnd) : 24 * 60);
    const slots: PickupSlot[] = [];
    for (let m = Math.ceil(start / SLOT_MINUTES) * SLOT_MINUTES; m < end; m += SLOT_MINUTES) {
      const at = lagosTimeToday(day, minutesToHHMM(m));
      if (at.getTime() >= earliest) slots.push({ iso: at.toISOString(), label: formatInstant(at) });
    }
    if (slots.length) days.push({ label: dayLabel(offset, day), slots });
  }
  return days;
}

/** The slot matching an ISO time, if it's still on offer. */
export function findSlot(days: SlotDay[], iso: string | null | undefined) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return days.flatMap((d) => d.slots).find((slot) => new Date(slot.iso).getTime() === t) ?? null;
}

/** "Today, 12:00 PM" / "Tomorrow, 9:30 AM" / "Friday 7 Nov, 4:00 PM" for a chosen pickup time. */
export function describePickupTime(at: Date, now: Date = new Date()) {
  const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(d);
  const diffDays = Math.round((new Date(dayKey(at)).getTime() - new Date(dayKey(now)).getTime()) / 86_400_000);
  const day =
    diffDays === 0
      ? "Today"
      : diffDays === 1
        ? "Tomorrow"
        : new Intl.DateTimeFormat("en-NG", { timeZone: TIMEZONE, weekday: "long", day: "numeric", month: "short" }).format(at);
  return `${day}, ${formatInstant(at)}`;
}
