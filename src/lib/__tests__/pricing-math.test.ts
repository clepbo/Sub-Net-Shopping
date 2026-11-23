import { describe, expect, it } from "vitest";
import { breakEvenMarkupPercent, customerPrice, marginKobo, markupFor } from "../pricing-math";

describe("markup pricing", () => {
  it("matches the worked example: ₦10,000 basket at 14% shows ₦11,400", () => {
    expect(customerPrice(1_000_000, 14)).toBe(1_140_000);
  });
  it("rounds up to clean figures by price band", () => {
    expect(customerPrice(20_000, 14)).toBe(23_000); // ₦200 → ₦228 → ₦230
    expect(customerPrice(100_000, 12)).toBe(115_000); // ₦1,000 → ₦1,120 → ₦1,150
    expect(customerPrice(1_000_000, 13.64)).toBe(1_140_000); // ₦11,364 → ₦11,400
  });
  it("never goes below the shelf price, even at 0%", () => {
    expect(customerPrice(123_456, 0)).toBeGreaterThanOrEqual(123_456);
  });
  it("covers commission and the gateway fee", () => {
    expect(breakEvenMarkupPercent(10, 2)).toBeCloseTo(13.636, 2);
    // At 14%, after 2% gateway and 10% commission on the customer price, the store still gets its shelf price.
    const shelf = 1_000_000;
    const price = customerPrice(shelf, 14);
    expect(price - price * 0.12).toBeGreaterThanOrEqual(shelf);
  });
  it("uses the category's markup, then its parent's, then the default", () => {
    expect(markupFor({ markupPercent: 12 }, 14)).toBe(12);
    expect(markupFor({ markupPercent: null, parent: { markupPercent: 16 } }, 14)).toBe(16);
    expect(markupFor(null, 14)).toBe(14);
  });
  it("adds up SubNet's margin", () => {
    expect(marginKobo([{ unitPriceKobo: 1150, shelfPriceKobo: 1000, quantity: 2 }, { unitPriceKobo: 500, shelfPriceKobo: null, quantity: 1 }])).toBe(300);
  });
});
