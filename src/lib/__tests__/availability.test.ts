import { describe, expect, it } from "vitest";
import { computeAvailability, type StoreSchedule } from "../availability";
import { formatInstant, lagosTimeToday } from "../time";

// PRD §20 example: store 8:00–21:00, last order 20:30, pickup 8:00–20:45,
// delivery 9:00–20:30. 2026-10-21 is a Wednesday.
const base: StoreSchedule = {
  hours: Array.from({ length: 7 }, (_, d) => ({ dayOfWeek: d, isOpen: d !== 0, opensAt: "08:00", closesAt: "21:00" })),
  lastOrderTime: "20:30",
  temporarilyClosed: false,
  pickupEnabled: true,
  pickupStart: "08:00",
  pickupEnd: "20:45",
  pickupPausedUntil: null,
  deliveryEnabled: true,
  deliveryStart: "09:00",
  deliveryEnd: "20:30",
  lastDeliveryOrderTime: null,
  deliveryPausedUntil: null,
};

/** A Wednesday at the given Lagos wall-clock time (UTC+1). */
const lagos = (hhmm: string, day = "2026-10-21") => new Date(`${day}T${hhmm}:00+01:00`);

describe("computeAvailability", () => {
  it("is fully available mid-day", () => {
    const a = computeAvailability(base, lagos("12:00"));
    expect(a.store).toBe("OPEN");
    expect(a.acceptingOrders).toBe(true);
    expect(a.pickup.state).toBe("AVAILABLE");
    expect(a.delivery.state).toBe("AVAILABLE");
  });

  it("can be open while delivery hasn't started", () => {
    const a = computeAvailability(base, lagos("08:30"));
    expect(a.store).toBe("OPEN");
    expect(a.pickup.state).toBe("AVAILABLE");
    expect(a.delivery.state).toBe("OUTSIDE_HOURS");
  });

  it("stops orders after the last order time but stays open", () => {
    const a = computeAvailability(base, lagos("20:35"));
    expect(a.store).toBe("OPEN");
    expect(a.acceptingOrders).toBe(false);
    expect(a.pickup.state).toBe("CUTOFF_PASSED");
  });

  it("is closed before opening and on closed days", () => {
    expect(computeAvailability(base, lagos("07:59")).store).toBe("CLOSED");
    expect(computeAvailability(base, lagos("12:00", "2026-10-25")).store).toBe("CLOSED"); // Sunday
    expect(computeAvailability(base, lagos("21:00")).store).toBe("CLOSED");
  });

  it("uses Lagos time regardless of the instant's UTC day", () => {
    // 23:30 UTC Saturday is 00:30 Sunday in Lagos — closed.
    expect(computeAvailability(base, new Date("2026-10-24T23:30:00Z")).store).toBe("CLOSED");
    // 07:30 UTC Wednesday is 08:30 in Lagos — open.
    expect(computeAvailability(base, new Date("2026-10-21T07:30:00Z")).store).toBe("OPEN");
  });

  it("temporary closure overrides the schedule", () => {
    const a = computeAvailability({ ...base, temporarilyClosed: true }, lagos("12:00"));
    expect(a.store).toBe("TEMPORARILY_CLOSED");
    expect(a.acceptingOrders).toBe(false);
    expect(a.pickup.state).toBe("STORE_CLOSED");
    expect(a.delivery.state).toBe("STORE_CLOSED");
  });

  it("pauses delivery until a set time while pickup stays available (PRD §19)", () => {
    const pausedUntil = lagos("18:00");
    const s = { ...base, deliveryPausedUntil: pausedUntil };
    const during = computeAvailability(s, lagos("15:00"));
    expect(during.delivery).toEqual({ state: "PAUSED", pausedUntil });
    expect(during.pickup.state).toBe("AVAILABLE");
    expect(computeAvailability(s, lagos("18:00")).delivery.state).toBe("AVAILABLE");
  });

  it("applies the separate last delivery order time", () => {
    const s = { ...base, lastDeliveryOrderTime: "19:00" };
    expect(computeAvailability(s, lagos("19:15")).delivery.state).toBe("CUTOFF_PASSED");
    expect(computeAvailability(s, lagos("19:15")).pickup.state).toBe("AVAILABLE");
  });

  it("reports services the store doesn't offer", () => {
    const a = computeAvailability({ ...base, deliveryEnabled: false }, lagos("12:00"));
    expect(a.delivery.state).toBe("NOT_OFFERED");
  });

  it("treats a missing service window as the store's hours", () => {
    const a = computeAvailability({ ...base, pickupStart: null, pickupEnd: null }, lagos("08:05"));
    expect(a.pickup.state).toBe("AVAILABLE");
  });
});

describe("time formatting", () => {
  it("formats instants in Lagos time with AM/PM", () => {
    expect(formatInstant(new Date("2026-10-21T17:00:00Z"))).toBe("6:00 PM");
  });

  it("resolves HH:MM to today's Lagos instant", () => {
    expect(lagosTimeToday(new Date("2026-10-21T23:30:00Z"), "18:00").toISOString()).toBe("2026-10-22T17:00:00.000Z");
  });
});
