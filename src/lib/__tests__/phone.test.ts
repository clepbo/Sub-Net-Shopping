import { describe, expect, it } from "vitest";
import { formatNigerianPhone, normalizeNigerianPhone } from "../phone";

describe("normalizeNigerianPhone", () => {
  it.each([
    ["08031234567", "+2348031234567"],
    ["0803 123 4567", "+2348031234567"],
    ["+234 803 123 4567", "+2348031234567"],
    ["2349051234567", "+2349051234567"],
    ["7011234567", "+2347011234567"],
    ["0811-123-4567", "+2348111234567"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeNigerianPhone(input)).toBe(expected);
  });

  it.each(["0803123456", "080312345678", "06031234567", "08231234567", "+14155552671", "abc"])(
    "rejects %s",
    (input) => {
      expect(normalizeNigerianPhone(input)).toBeNull();
    },
  );

  it("formats for display", () => {
    expect(formatNigerianPhone("+2348031234567")).toBe("0803 123 4567");
  });
});
