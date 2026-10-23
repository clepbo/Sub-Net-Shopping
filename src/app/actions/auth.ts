"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, destroySession } from "@/lib/session";
import { ROLE_HOME } from "@/lib/session-token";
import { normalizeNigerianPhone } from "@/lib/phone";
import { logActivity, notify } from "@/lib/activity";
import { formValues, type ActionState } from "@/lib/action-state";
import {
  customerRegistration,
  fieldErrors,
  login as loginSchema,
  riderRegistration,
  supermarketRegistration,
} from "@/lib/validation";
import { Prisma } from "@/generated/prisma/client";

/** Returns field errors when the email or phone is already registered. */
async function takenIdentity(email: string, phone: string) {
  const existing = await db.user.findFirst({
    where: { OR: [{ email }, { phone }] },
    select: { email: true, phone: true },
  });
  if (!existing) return null;
  const errors: Record<string, string> = {};
  if (existing.email === email) errors.email = "An account with this email already exists";
  if (existing.phone === phone) errors.phone = "An account with this phone number already exists";
  return errors;
}

function isUniqueViolation(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

async function notifyAdmins(title: string, body: string) {
  const admins = await db.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true } });
  await db.notification.createMany({ data: admins.map((a) => ({ userId: a.id, title, body })) });
}

export async function registerCustomer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = customerRegistration.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const d = parsed.data;

  const taken = await takenIdentity(d.email, d.phone);
  if (taken) return { fieldErrors: taken, values };

  let user;
  try {
    user = await db.user.create({
      data: {
        role: "CUSTOMER",
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email,
        phone: d.phone,
        passwordHash: await hashPassword(d.password),
        customer: { create: {} },
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { error: "That email or phone number is already registered", values };
    throw err;
  }
  await logActivity({ actorId: user.id, action: "customer.registered", targetType: "user", targetId: user.id });
  await createSession({ uid: user.id, role: user.role, ver: user.sessionVersion });
  redirect("/");
}

const DEFAULT_HOURS = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  isOpen: dayOfWeek !== 0,
  opensAt: dayOfWeek !== 0 ? "08:00" : null,
  closesAt: dayOfWeek !== 0 ? "21:00" : null,
}));

export async function registerSupermarket(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const raw = Object.fromEntries(formData) as Record<string, FormDataEntryValue>;
  if (raw.latitude === "") delete raw.latitude;
  if (raw.longitude === "") delete raw.longitude;
  const parsed = supermarketRegistration.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const d = parsed.data;

  const taken = await takenIdentity(d.email, d.phone);
  if (taken) return { fieldErrors: taken, values };

  let user;
  try {
    user = await db.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          role: "SUPERMARKET",
          firstName: d.contactFirstName,
          lastName: d.contactLastName,
          email: d.email,
          phone: d.phone,
          passwordHash: await hashPassword(d.password),
        },
      });
      await tx.supermarket.create({
        data: {
          ownerId: u.id,
          name: d.businessName,
          contactName: `${d.contactFirstName} ${d.contactLastName}`,
          phone: d.phone,
          email: d.email,
          address: d.address,
          area: d.area,
          latitude: d.latitude ?? null,
          longitude: d.longitude ?? null,
          registrationNumber: d.registrationNumber,
          description: d.description,
          lastOrderTime: "20:30",
          hours: { create: DEFAULT_HOURS },
          staff: { create: { userId: u.id, role: "MANAGER" } },
        },
      });
      return u;
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { error: "That email or phone number is already registered", values };
    throw err;
  }
  await logActivity({ actorId: user.id, action: "supermarket.registered", targetType: "user", targetId: user.id, details: d.businessName });
  await notifyAdmins("New supermarket awaiting approval", `${d.businessName} (${d.address}) registered and needs review.`);
  await notify(user.id, "Registration received", "Your supermarket is pending approval. We'll notify you once an admin has reviewed it.");
  await createSession({ uid: user.id, role: user.role, ver: user.sessionVersion });
  redirect("/merchant");
}

export async function registerRider(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = riderRegistration.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const d = parsed.data;

  const taken = await takenIdentity(d.email, d.phone);
  if (taken) return { fieldErrors: taken, values };

  let user;
  try {
    user = await db.user.create({
      data: {
        role: "RIDER",
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email,
        phone: d.phone,
        passwordHash: await hashPassword(d.password),
        rider: {
          create: {
            vehicleType: d.vehicleType,
            plateNumber: d.plateNumber,
            vehicleMake: d.vehicleMake,
            vehicleColor: d.vehicleColor,
            driversLicense: d.driversLicense,
          },
        },
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { error: "That email or phone number is already registered", values };
    throw err;
  }
  await logActivity({ actorId: user.id, action: "rider.registered", targetType: "user", targetId: user.id });
  await notifyAdmins("New rider awaiting approval", `${d.firstName} ${d.lastName} registered as a rider and needs review.`);
  await notify(user.id, "Registration received", "Your rider account is pending approval. We'll notify you once an admin has reviewed it.");
  await createSession({ uid: user.id, role: user.role, ver: user.sessionVersion });
  redirect("/rider");
}

// Compared against when no user matches, so response time doesn't reveal
// whether an account exists.
const DUMMY_HASH = "$2b$12$0qMTKpkHaKKgOPDlyjwXwuW9awV5WGbSIsoZhryNeTcMFEIbr4wbC";

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const { identifier, password } = parsed.data;

  const phone = normalizeNigerianPhone(identifier);
  const user = await db.user.findFirst({
    where: identifier.includes("@") ? { email: identifier.toLowerCase() } : { phone: phone ?? "-" },
  });
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) return { error: "Incorrect email/phone or password", values };
  if (user.status === "SUSPENDED") {
    return { error: "This account has been suspended. Contact Sub Net support for help.", values };
  }

  await createSession({ uid: user.id, role: user.role, ver: user.sessionVersion });
  const next = String(formData.get("next") ?? "");
  // Only follow same-site relative paths.
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : ROLE_HOME[user.role]);
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
