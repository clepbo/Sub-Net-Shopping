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
  deliveryBaseFee: z.coerce.number().min(0).max(100_000),
  deliveryPerKm: z.coerce.number().min(0).max(10_000),
  deliveryMaxKm: z.coerce.number().min(1).max(100),
});

export const customerAddress = z.object({
  label: z.string().trim().min(1, "Give this address a name, e.g. Home").max(40),
  address: z.string().trim().min(5, "Enter the street address").max(200),
  landmark: optionalText(120),
  phone: nigerianPhone,
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
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

// ─── Catalogue ─────────────────────────────────────────────────────────

const naira = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const cleaned = v.replace(/[₦,\s]/g, "");
    if (!/^\d+(\.\d{1,2})?$/.test(cleaned) || Number(cleaned) <= 0 || Number(cleaned) > 100_000_000) {
      ctx.addIssue({ code: "custom", message: "Enter a price in naira, e.g. 1500 or 1,250.50" });
      return z.NEVER;
    }
    return Math.round(Number(cleaned) * 100);
  });

const optionalStock = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    if (!/^\d+$/.test(v) || Number(v) > 1_000_000) {
      ctx.addIssue({ code: "custom", message: "Enter a whole number, or leave blank if you don't track stock" });
      return z.NEVER;
    }
    return Number(v);
  });

export const listingFields = z.object({
  sku: z.string().trim().min(1, "Enter your SKU or product code").max(60),
  priceKobo: naira,
  stockQuantity: optionalStock,
  status: z.enum(["AVAILABLE", "OUT_OF_STOCK", "HIDDEN"]),
});

export const quickListingUpdate = z.object({ priceKobo: naira, stockQuantity: optionalStock });

export const productDetails = z.object({
  name: z.string().trim().min(2, "Enter the product name").max(160),
  brand: optionalText(80),
  unit: optionalText(40),
  barcode: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s/g, ""))
    .pipe(z.union([z.literal(""), z.string().regex(/^\d{6,14}$/, "Barcodes are 6–14 digits")]))
    .transform((v) => v || null),
  categoryId: z.string().trim().min(1, "Choose a category"),
  description: optionalText(2000),
  isBulky: z.boolean(),
});

export const categoryFields = z.object({
  name: z.string().trim().min(2, "Enter a name").max(60),
  icon: optionalText(8),
  sortOrder: z.coerce.number().int().min(0).max(10_000),
  parentId: z
    .string()
    .trim()
    .transform((v) => v || null),
});
