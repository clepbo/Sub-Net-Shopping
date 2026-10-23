import { describe, expect, it } from "vitest";
import { canAdjustItems, canTransition, newOrderNumber, orderTotals } from "../order-rules";

describe("order transitions", () => {
  it("lets the store move an order through pickup", () => {
    expect(canTransition("STORE", "PLACED", "CONFIRMED")).toBe(true);
    expect(canTransition("STORE", "CONFIRMED", "READY_FOR_PICKUP")).toBe(true);
    expect(canTransition("STORE", "READY_FOR_PICKUP", "COLLECTED")).toBe(true);
  });

  it("doesn't allow skipping steps or reopening", () => {
    expect(canTransition("STORE", "PLACED", "READY_FOR_PICKUP")).toBe(false);
    expect(canTransition("STORE", "PLACED", "COLLECTED")).toBe(false);
    expect(canTransition("STORE", "COLLECTED", "CANCELLED")).toBe(false);
    expect(canTransition("STORE", "CANCELLED", "CONFIRMED")).toBe(false);
  });

  it("lets customers cancel only before the store confirms", () => {
    expect(canTransition("CUSTOMER", "PLACED", "CANCELLED")).toBe(true);
    expect(canTransition("CUSTOMER", "CONFIRMED", "CANCELLED")).toBe(false);
    expect(canTransition("CUSTOMER", "PLACED", "CONFIRMED")).toBe(false);
  });

  it("allows item changes only while placed", () => {
    expect(canAdjustItems("PLACED")).toBe(true);
    expect(canAdjustItems("CONFIRMED")).toBe(false);
  });
});

describe("orderTotals", () => {
  it("sums lines", () => {
    expect(orderTotals([{ unitPriceKobo: 25_000, quantity: 3 }, { unitPriceKobo: 1_250_000, quantity: 1 }])).toEqual({
      subtotalKobo: 1_325_000,
      deliveryFeeKobo: 0,
      totalKobo: 1_325_000,
    });
  });
});

describe("newOrderNumber", () => {
  it("pads to 8 digits", () => {
    expect(newOrderNumber(() => 0.000042)).toBe("SN-00004200");
  });
});
