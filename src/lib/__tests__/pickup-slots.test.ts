import { describe, expect, it } from "vitest";
import { describePickupTime, findSlot, pickupSlots, type SlotSchedule } from "../pickup-slots";

// Mon–Sat 8:00–21:00, Sunday closed; pickup 8 AM–6 PM; 30 min to prepare.
// 2026-11-04 is a Wednesday.
const base: SlotSchedule = {
  hours: Array.from({ length: 7 }, (_, d) => ({ dayOfWeek: d, isOpen: d !== 0, opensAt: "08:00", closesAt: "21:00" })),
  lastOrderTime: "20:30",
  temporarilyClosed: false,
  pickupEnabled: true,
  pickupStart: "08:00",
  pickupEnd: "18:00",
  pickupPausedUntil: null,
  deliveryEnabled: false,
  deliveryStart: null,
  deliveryEnd: null,
  lastDeliveryOrderTime: null,
  deliveryPausedUntil: null,
  pickupPrepMinutes: 30,
};
const lagos = (hhmm: string, day = "2026-11-04") => new Date(`${day}T${hhmm}:00+01:00`);
const labels = (s: SlotSchedule, now: Date) => pickupSlots(s, now).map((d) => [d.label, d.slots.map((x) => x.label)] as const);

describe("pickupSlots", () => {
  it("offers 30-minute slots within the pickup window, after preparation time", () => {
    const [today] = labels(base, lagos("10:10"));
    expect(today[0]).toBe("Today");
    // 10:10 + 30 min prep → first slot 11:00 (10:30 is too soon); last slot starts 5:30 PM.
    expect(today[1][0]).toBe("11:00 AM");
    expect(today[1].at(-1)).toBe("5:30 PM");
    expect(today[1]).toContain("12:00 PM");
  });

  it("covers today and the next two days, skipping closed days", () => {
    // Friday evening: Friday's window is over, Saturday open, Sunday closed, so just Saturday.
    const days = labels(base, lagos("19:00", "2026-11-06"));
    expect(days.map((d) => d[0])).toEqual(["Tomorrow"]);
    expect(days[0][1][0]).toBe("8:00 AM");
  });

  it("only offers later days after the last order time", () => {
    const days = labels(base, lagos("20:45"));
    expect(days[0][0]).toBe("Tomorrow");
  });

  it("starts after a pickup pause", () => {
    const s = { ...base, pickupPausedUntil: lagos("14:00") };
    expect(labels(s, lagos("10:00"))[0][1][0]).toBe("2:00 PM");
  });

  it("offers nothing when pickup is off or the store is temporarily closed", () => {
    expect(pickupSlots({ ...base, pickupEnabled: false }, lagos("10:00"))).toEqual([]);
    expect(pickupSlots({ ...base, temporarilyClosed: true }, lagos("10:00"))).toEqual([]);
  });

  it("uses store hours when no pickup window is set", () => {
    const [today] = labels({ ...base, pickupStart: null, pickupEnd: null }, lagos("10:00"));
    expect(today[1].at(-1)).toBe("8:30 PM");
  });

  it("finds a chosen slot only if it's still offered", () => {
    const days = pickupSlots(base, lagos("10:00"));
    expect(findSlot(days, lagos("12:00").toISOString())).not.toBeNull();
    expect(findSlot(days, lagos("12:10").toISOString())).toBeNull();
    expect(findSlot(days, lagos("19:00").toISOString())).toBeNull();
  });
});

describe("describePickupTime", () => {
  it("names the day relative to now", () => {
    expect(describePickupTime(lagos("12:00"), lagos("09:00"))).toBe("Today, 12:00 PM");
    expect(describePickupTime(lagos("09:30", "2026-11-05"), lagos("21:00"))).toBe("Tomorrow, 9:30 AM");
  });
});
