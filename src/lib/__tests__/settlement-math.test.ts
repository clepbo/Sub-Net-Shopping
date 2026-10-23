import { describe, expect, it } from "vitest";
import { computeSettlement } from "../settlement-math";

describe("computeSettlement", () => {
  it("nets online sales against commission owed on pay-at-store sales", () => {
    // PRD §18: ₦50,000 at 10% → ₦5,000 commission.
    const s = computeSettlement([
      { totalKobo: 5_000_000, commissionKobo: 500_000, paymentMethod: "ONLINE" },
      { totalKobo: 2_000_000, commissionKobo: 200_000, paymentMethod: "PAY_AT_STORE" },
    ]);
    expect(s).toEqual({
      orderCount: 2,
      grossKobo: 7_000_000,
      commissionKobo: 700_000,
      onlineNetKobo: 4_500_000,
      storeOwesKobo: 200_000,
      payableKobo: 4_300_000,
    });
  });

  it("goes negative when the store owes Sub Net", () => {
    expect(computeSettlement([{ totalKobo: 1_000_000, commissionKobo: 100_000, paymentMethod: "PAY_AT_STORE" }]).payableKobo).toBe(-100_000);
  });

  it("is zero for no orders", () => {
    expect(computeSettlement([]).payableKobo).toBe(0);
  });
});
