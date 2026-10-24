import { describe, expect, it } from "vitest";
import { canCarry, deliveryQuote, requiredVehicle, roadDistanceKm } from "../delivery-rules";

const rates = { baseKobo: 50_000, perKmKobo: 15_000, maxKm: 20 };
const store = { lat: 6.3176, lng: 5.6145 }; // GRA, Benin City
const near = { lat: 6.335, lng: 5.627 }; // ~2.3 km straight line

describe("requiredVehicle", () => {
  it("uses a motorcycle for a normal basket", () => {
    expect(requiredVehicle([{ isBulky: false, quantity: 10 }])).toBe("MOTORCYCLE");
  });
  it("needs a car for large baskets", () => {
    expect(requiredVehicle([{ isBulky: false, quantity: 26 }])).toBe("CAR");
  });
  it("needs a van for bulky items like a fridge (PRD §14)", () => {
    expect(requiredVehicle([{ isBulky: false, quantity: 2 }, { isBulky: true, quantity: 1 }])).toBe("VAN");
    expect(requiredVehicle([{ isBulky: true, quantity: 0 }])).toBe("MOTORCYCLE");
  });
});

describe("canCarry", () => {
  it("lets bigger vehicles take smaller jobs, not the reverse", () => {
    expect(canCarry("VAN", "MOTORCYCLE")).toBe(true);
    expect(canCarry("BULKY", "VAN")).toBe(true);
    expect(canCarry("MOTORCYCLE", "VAN")).toBe(false);
    expect(canCarry("CAR", "VAN")).toBe(false);
  });
});

describe("deliveryQuote", () => {
  it("prices by road distance and rounds up to ₦50", () => {
    const km = roadDistanceKm(store, near);
    const q = deliveryQuote({ from: store, to: near, items: [{ isBulky: false, quantity: 3 }], rates });
    expect(q).toMatchObject({ ok: true, vehicle: "MOTORCYCLE", distanceKm: km });
    if (q.ok) {
      expect(q.feeKobo % 5_000).toBe(0);
      expect(q.feeKobo).toBeGreaterThanOrEqual(50_000 + 15_000 * km);
    }
  });
  it("charges more for a van", () => {
    const bike = deliveryQuote({ from: store, to: near, items: [{ isBulky: false, quantity: 1 }], rates });
    const van = deliveryQuote({ from: store, to: near, items: [{ isBulky: true, quantity: 1 }], rates });
    expect(bike.ok && van.ok && van.feeKobo > bike.feeKobo).toBe(true);
  });
  it("refuses beyond the maximum distance or without a store location", () => {
    expect(deliveryQuote({ from: store, to: { lat: 6.6, lng: 5.9 }, items: [], rates })).toMatchObject({ ok: false });
    expect(deliveryQuote({ from: null, to: near, items: [], rates })).toMatchObject({ ok: false });
  });
});
