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

describe("online payment transitions", () => {
  it("only the system moves an order from awaiting payment to placed", () => {
    expect(canTransition("SYSTEM", "AWAITING_PAYMENT", "PLACED")).toBe(true);
    expect(canTransition("STORE", "AWAITING_PAYMENT", "CONFIRMED")).toBe(false);
    expect(canTransition("CUSTOMER", "AWAITING_PAYMENT", "PLACED")).toBe(false);
  });
  it("customers can abandon an unpaid order", () => {
    expect(canTransition("CUSTOMER", "AWAITING_PAYMENT", "CANCELLED")).toBe(true);
  });
});

describe("delivery transitions", () => {
  it("lets the rider take a ready delivery order out and deliver it", () => {
    expect(canTransition("RIDER", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERY")).toBe(true);
    expect(canTransition("RIDER", "OUT_FOR_DELIVERY", "DELIVERED", "DELIVERY")).toBe(true);
    expect(canTransition("RIDER", "CONFIRMED", "OUT_FOR_DELIVERY", "DELIVERY")).toBe(false);
  });
  it("keeps pickup and delivery endings apart", () => {
    expect(canTransition("STORE", "READY_FOR_PICKUP", "COLLECTED", "DELIVERY")).toBe(false);
    expect(canTransition("RIDER", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "PICKUP")).toBe(false);
  });
  it("stops the store cancelling once the rider has the order", () => {
    expect(canTransition("STORE", "OUT_FOR_DELIVERY", "CANCELLED", "DELIVERY")).toBe(false);
  });
});
