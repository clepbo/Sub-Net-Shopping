import { z } from "zod";
import { normalizeNigerianPhone } from "./phone";

export const nigerianPhone = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const normalized = normalizeNigerianPhone(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "Enter a valid Nigerian phone number, e.g. 0803 123 4567" });
      return z.NEVER;
    }
    return normalized;
  });

export const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));
export const password = z.string().min(8, "Password must be at least 8 characters").max(128);
const name = (label: string) => z.string().trim().min(1, `${label} is required`).max(80);

/** "HH:MM" in 24-hour time. */
export const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour)");
const optionalClockTime = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(clockTime.nullable());

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

function confirmPasswords<T extends { password: string; confirmPassword: string }>(data: T, ctx: z.RefinementCtx) {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match" });
  }
}

export const customerRegistration = z
  .object({
    firstName: name("First name"),
    lastName: name("Last name"),
    phone: nigerianPhone,
    email,
    password,
    confirmPassword: z.string(),
  })
  .superRefine(confirmPasswords);

export const supermarketRegistration = z
  .object({
    businessName: z.string().trim().min(2, "Business name is required").max(120),
    contactFirstName: name("Contact first name"),
    contactLastName: name("Contact last name"),
    phone: nigerianPhone,
    email,
    password,
    confirmPassword: z.string(),
    address: z.string().trim().min(5, "Business address is required").max(200),
    area: optionalText(80),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    registrationNumber: optionalText(40),
    description: optionalText(500),
  })
  .superRefine(confirmPasswords);

export const vehicleTypes = ["MOTORCYCLE", "CAR", "VAN", "BULKY"] as const;

export const vehicleDetails = z.object({
  vehicleType: z.enum(vehicleTypes, { message: "Choose a vehicle type" }),
  plateNumber: z.string().trim().toUpperCase().min(3, "Plate number is required").max(20),
  vehicleMake: optionalText(60),
  vehicleColor: optionalText(30),
  driversLicense: optionalText(40),
});

export const riderRegistration = z
  .object({
    firstName: name("First name"),
    lastName: name("Last name"),
    phone: nigerianPhone,
    email,
    password,
    confirmPassword: z.string(),
  })
  .and(vehicleDetails)
  .superRefine(confirmPasswords);

export const login = z.object({
  identifier: z.string().trim().min(1, "Enter your email or phone number"),
  password: z.string().min(1, "Enter your password"),
});

export const profileUpdate = z.object({
  firstName: name("First name"),
  lastName: name("Last name"),
  phone: nigerianPhone,
});

export const passwordChange = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    password,
    confirmPassword: z.string(),
  })
  .superRefine(confirmPasswords);

export const supermarketProfile = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  contactName: z.string().trim().min(2, "Contact name is required").max(120),
  phone: nigerianPhone,
  email,
  address: z.string().trim().min(5, "Address is required").max(200),
  area: optionalText(80),
  latitude: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number().min(-90).max(90).nullable()),
  longitude: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number().min(-180).max(180).nullable()),
  registrationNumber: optionalText(40),
  description: optionalText(500),
});

function windowCheck(start: string | null, end: string | null, label: string, path: string, ctx: z.RefinementCtx) {
  if ((start === null) !== (end === null)) {
    ctx.addIssue({ code: "custom", path: [path], message: `Set both ${label} start and end, or neither` });
  } else if (start && end && end <= start) {
    ctx.addIssue({ code: "custom", path: [path], message: `${label} must end after it starts` });
  }
}

export const dayHours = z
  .object({ isOpen: z.boolean(), opensAt: optionalClockTime, closesAt: optionalClockTime })
  .superRefine((d, ctx) => {
    if (!d.isOpen) return;
    if (!d.opensAt || !d.closesAt) {
      ctx.addIssue({ code: "custom", message: "Open days need an opening and closing time" });
    } else if (d.closesAt <= d.opensAt) {
      ctx.addIssue({ code: "custom", message: "Closing time must be after opening time" });
    }
  });

export const operatingSchedule = z
  .object({
    days: z.array(dayHours).length(7),
    lastOrderTime: optionalClockTime,
    pickupEnabled: z.boolean(),
    pickupStart: optionalClockTime,
    pickupEnd: optionalClockTime,
    deliveryEnabled: z.boolean(),
    deliveryStart: optionalClockTime,
    deliveryEnd: optionalClockTime,
    lastDeliveryOrderTime: optionalClockTime,
  })
  .superRefine((s, ctx) => {
    windowCheck(s.pickupStart, s.pickupEnd, "Pickup hours", "pickupStart", ctx);
    windowCheck(s.deliveryStart, s.deliveryEnd, "Delivery hours", "deliveryStart", ctx);
  });

export const posIntegration = z.object({
  posProvider: optionalText(80),
  posHasApi: z.enum(["yes", "no", "unknown"]).transform((v) => (v === "unknown" ? null : v === "yes")),
  posIntegrationNotes: optionalText(1000),
});

export const platformSettings = z.object({
  supermarketCommissionPercent: z.coerce.number().min(0).max(50),
  riderCommissionPercent: z.coerce.number().min(0).max(50),
});

export type FieldErrors = Record<string, string>;

/** Flattens zod issues into { field: firstMessage }. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
