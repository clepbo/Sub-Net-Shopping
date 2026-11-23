import { describe, expect, it } from "vitest";



describe("rider cash limit", async () => {
  const { overLimit, cashJobAllowed } = await import("../rider-wallet-rules");
  const limit = 2_000_000; // ₦20,000
  it("pauses at the limit, as in the spec (balance ≤ −limit)", () => {
    expect(overLimit(-1_999_999, limit)).toBe(false);
    expect(overLimit(-2_000_000, limit)).toBe(true);
    expect(overLimit(0, limit)).toBe(false);
  });
  it("won't hand a cash job to a rider it would push past the limit", () => {
    expect(cashJobAllowed(-1_500_000, 400_000, limit)).toBe(true);
    expect(cashJobAllowed(-1_500_000, 500_000, limit)).toBe(false);
    expect(cashJobAllowed(-2_000_000, 1, limit)).toBe(false);
  });
});
