import { describe, expect, it } from "vitest";
import { customerRegistration, fieldErrors, operatingSchedule } from "../validation";

const day = { isOpen: true, opensAt: "08:00", closesAt: "21:00" };

describe("customerRegistration", () => {
  const valid = {
    firstName: "Osas",
    lastName: "Igbinedion",
    phone: "0803 123 4567",
    email: " Osas@Example.com ",
    password: "s3cure-pass",
    confirmPassword: "s3cure-pass",
  };

  it("normalises phone and email", () => {
    const r = customerRegistration.parse(valid);
    expect(r.phone).toBe("+2348031234567");
    expect(r.email).toBe("osas@example.com");
  });

  it("requires 8+ character matching passwords", () => {
    const r = customerRegistration.safeParse({ ...valid, password: "short", confirmPassword: "other" });
    expect(r.success).toBe(false);
    const errors = fieldErrors(r.error!);
    expect(errors.password).toMatch(/8 characters/);
    expect(errors.confirmPassword).toMatch(/do not match/);
  });
});

describe("operatingSchedule", () => {
  const schedule = {
    days: Array(7).fill(day),
    lastOrderTime: "20:30",
    pickupEnabled: true,
    pickupStart: "",
    pickupEnd: "",
    deliveryEnabled: true,
    deliveryStart: "09:00",
    deliveryEnd: "20:30",
    lastDeliveryOrderTime: "",
  };

  it("accepts a valid schedule and blanks become null", () => {
    const r = operatingSchedule.parse(schedule);
    expect(r.pickupStart).toBeNull();
    expect(r.lastDeliveryOrderTime).toBeNull();
  });

  it("rejects closing before opening", () => {
    const days = [...schedule.days];
    days[2] = { isOpen: true, opensAt: "21:00", closesAt: "08:00" };
    expect(operatingSchedule.safeParse({ ...schedule, days }).success).toBe(false);
  });

  it("rejects half-set service windows", () => {
    expect(operatingSchedule.safeParse({ ...schedule, deliveryEnd: "" }).success).toBe(false);
  });
});
