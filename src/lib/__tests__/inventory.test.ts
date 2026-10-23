import { describe, expect, it } from "vitest";
import { parseCsv } from "../csv";
import { planImport } from "../csv-import";
import { deriveAvailability, parseNairaToKobo } from "../inventory";

describe("deriveAvailability", () => {
  it("derives from stock when available", () => {
    expect(deriveAvailability("AVAILABLE", null)).toBe("IN_STOCK");
    expect(deriveAvailability("AVAILABLE", 0)).toBe("OUT_OF_STOCK");
    expect(deriveAvailability("AVAILABLE", 5)).toBe("LOW_STOCK");
    expect(deriveAvailability("AVAILABLE", 6)).toBe("IN_STOCK");
  });
  it("respects explicit choices", () => {
    expect(deriveAvailability("HIDDEN", 100)).toBe("UNAVAILABLE");
    expect(deriveAvailability("OUT_OF_STOCK", 100)).toBe("OUT_OF_STOCK");
  });
});

describe("parseNairaToKobo", () => {
  it.each([
    ["900", 90_000],
    ["₦1,250.50", 125_050],
    ["NGN 4650", 465_000],
    ["0.5", 50],
  ])("%s → %d", (input, kobo) => expect(parseNairaToKobo(input)).toBe(kobo));
  it.each(["", "abc", "-5", "0", "1.234"])("rejects %s", (input) => expect(parseNairaToKobo(input)).toBeNull());
});

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, CRLF and a BOM", () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n\r\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
    ]);
  });
});

describe("planImport", () => {
  const categories: Record<string, string> = { "groceries & staples": "cat_groceries", groceries: "cat_groceries" };
  const resolve = (n: string) => categories[n.toLowerCase()] ?? null;

  it("maps common POS headers and reports bad rows by line", () => {
    const csv = [
      "Product Code,Product Name,Selling Price,Qty,EAN,Category",
      "IND-001,Indomie Chicken,900,50,0012345678905,Groceries",
      "IND-002,No price,,10,,",
      "IND-001,Duplicate,100,1,,",
      "PEAK-1,Peak Milk,\"1,200\",,,Mystery",
      "GOLD-1,Golden Penny Semovita 1kg,\"₦2,450.00\",3,,",
    ].join("\n");
    const plan = planImport(csv, resolve);
    expect(plan.items.map((i) => i.sku)).toEqual(["IND-001", "GOLD-1"]);
    expect(plan.items[0]).toMatchObject({ priceKobo: 90_000, stockQuantity: 50, categoryId: "cat_groceries", barcode: "0012345678905" });
    expect(plan.items[1]).toMatchObject({ priceKobo: 245_000, stockQuantity: 3 });
    expect(plan.errors).toEqual([
      { line: 3, message: 'Price "" isn\'t a valid amount' },
      { line: 4, message: "SKU IND-001 appears more than once" },
      { line: 5, message: 'Unknown category "Mystery"' },
    ]);
  });

  it("requires sku, name and price columns", () => {
    expect(planImport("name,price\nA,1", resolve).errors[0].message).toMatch(/sku/);
  });
});
