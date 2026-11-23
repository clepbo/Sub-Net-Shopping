import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../db", () => ({ db: {} }));

describe("sms helpers", async () => {
  const { termiiNumber, smsText } = await import("../sms");
  it("formats numbers for Termii", () => {
    expect(termiiNumber("+2348031234567")).toBe("2348031234567");
  });
  it("collapses whitespace and caps length at two pages", () => {
    expect(smsText("a\n  b")).toBe("a b");
    expect(smsText("x".repeat(400))).toHaveLength(306);
  });
});
