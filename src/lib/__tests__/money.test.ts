import { describe, expect, it } from "vitest";
import { formatNaira, splitCommission } from "../money";

describe("splitCommission", () => {
  it("matches the PRD rider example: ₦5,000 at 7%", () => {
    expect(splitCommission(500_000, 7)).toEqual({ commissionKobo: 35_000, netKobo: 465_000 });
  });

  it("matches the PRD supermarket example: ₦50,000 at 10%", () => {
    expect(splitCommission(5_000_000, 10)).toEqual({ commissionKobo: 500_000, netKobo: 4_500_000 });
  });

  it("rounds to the nearest kobo", () => {
    expect(splitCommission(333, 7)).toEqual({ commissionKobo: 23, netKobo: 310 });
  });
});

describe("formatNaira", () => {
  it("formats kobo as naira", () => {
    expect(formatNaira(90_000)).toBe("₦900");
    expect(formatNaira(465_050)).toBe("₦4,650.5");
  });
});
