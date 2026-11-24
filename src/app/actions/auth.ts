"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, destroySession } from "@/lib/session";
import { mergeGuestCart } from "@/lib/cart-owner";
import { ROLE_HOME } from "@/lib/session-token";
import { normalizeNigerianPhone } from "@/lib/phone";
import { logActivity, notify } from "@/lib/activity";
import { formValues, type ActionState } from "@/lib/action-state";
import {
  customerRegistration,
  fieldErrors,
  login as loginSchema,
  passwordReset,
  passwordResetRequest,
  riderRegistration,
  supermarketRegistration,
} from "@/lib/validation";
import { Prisma } from "@/generated/prisma/client";
import { deleteStoredFile, storeImage } from "@/lib/storage";
import { clearFailures, clientIp, lockedFor, recordAttempt } from "@/lib/throttle";
import { createResetToken, resetPassword, RESET_TTL_MINUTES } from "@/lib/password-reset";
import { emailLayout, sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/app-url";

/** Returns field errors when the email or phone is already registered. */
async function takenIdentity(email: string, phone: string) {
  const existing = await db.user.findFirst({
    where: { OR: [{ email }, { phone }] },
    select: { email: true, phone: true, role: true, ownedMarkets: { select: { status: true }, take: 1 }, rider: { select: { status: true } } },
  });
  if (!existing) return null;
  // Registering again while an application is waiting: point them at it instead.
  const pending = existing.ownedMarkets[0]?.status === "PENDING" || existing.rider?.status === "PENDING";
  if (pending) {
    return {
      $pending:
        existing.role === "RIDER"
          ? "You've already applied to deliver with SubNet and your application is waiting for approval. Sign in to check its status."
          : "This supermarket is already registered and waiting for approval. Sign in to check its status.",
    } as Record<string, string>;
  }
  const errors: Record<string, string> = {};
  if (existing.email === email) errors.email = "An account with this email already exists";
  if (existing.phone === phone) errors.phone = "An account with this phone number already exists";
  return errors;
}

/** Only same-site relative paths, so `next` can't send anyone off-site. */
function safeNext(value: FormDataEntryValue | null) {
  const next = String(value ?? "");
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : null;
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
  if (taken?.$pending) return { error: taken.$pending, values };
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
  const newUserId = user.id;
  // Bookkeeping runs after the response so sign-up feels instant.
  after(() => logActivity({ actorId: newUserId, action: "customer.registered", targetType: "user", targetId: newUserId }));
  await createSession({ uid: user.id, role: user.role, ver: user.sessionVersion });
  // Anything they put in their cart as a guest comes with them.
  await mergeGuestCart(user.id);
  const next = safeNext(formData.get("next"));
  redirect(next ? `${next}${next.includes("?") ? "&" : "?"}welcome=1` : "/?welcome=1");
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
  delete raw.logo;
  if (raw.latitude === "") delete raw.latitude;
  if (raw.longitude === "") delete raw.longitude;
  const parsed = supermarketRegistration.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const d = parsed.data;

  const taken = await takenIdentity(d.email, d.phone);
  if (taken?.$pending) return { error: taken.$pending, values };
  if (taken) return { fieldErrors: taken, values };

  // Optional logo: stored before the account so a bad file is reported up front.
  const logo = formData.get("logo");
  let logoUrl: string | null = null;
  if (logo instanceof File && logo.size > 0) {
    try {
      logoUrl = (await storeImage(logo, "supermarkets/new")).url;
    } catch (err) {
      return { fieldErrors: { logo: err instanceof Error ? err.message : "Upload failed" }, values };
    }
  }

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
          logoUrl,
          lastOrderTime: "20:30",
          hours: { create: DEFAULT_HOURS },
          staff: { create: { userId: u.id, role: "MANAGER" } },
        },
      });
      return u;
    });
  } catch (err) {
    if (logoUrl) await deleteStoredFile(logoUrl).catch(() => {});
    if (isUniqueViolation(err)) return { error: "That email or phone number is already registered", values };
    throw err;
  }
  const ownerId = user.id;
  after(() =>
    Promise.all([
      logActivity({ actorId: ownerId, action: "supermarket.registered", targetType: "user", targetId: ownerId, details: d.businessName }),
      notifyAdmins("New supermarket awaiting approval", `${d.businessName} (${d.address}) registered and needs review.`),
      notify(ownerId, "Registration received", "Your supermarket is pending approval. We'll notify you once an admin has reviewed it."),
    ]),
  );
  await createSession({ uid: user.id, role: user.role, ver: user.sessionVersion });
  redirect("/merchant?welcome=1");
}

export async function registerRider(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = riderRegistration.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const d = parsed.data;

  const taken = await takenIdentity(d.email, d.phone);
  if (taken?.$pending) return { error: taken.$pending, values };
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
  const riderUserId = user.id;
  after(() =>
    Promise.all([
      logActivity({ actorId: riderUserId, action: "rider.registered", targetType: "user", targetId: riderUserId }),
      notifyAdmins("New rider awaiting approval", `${d.firstName} ${d.lastName} registered as a rider and needs review.`),
      notify(riderUserId, "Registration received", "Your rider account is pending approval. We'll notify you once an admin has reviewed it."),
    ]),
  );
  await createSession({ uid: user.id, role: user.role, ver: user.sessionVersion });
  redirect("/rider?welcome=1");
}

// Compared against when no user matches, so response time doesn't reveal
// whether an account exists.
const DUMMY_HASH = "$2b$11$egdk/AXoMl6R6jlJTWHBq.9HWWMBAl1bijWxjIK.mL1rHKHK9sIhS";

function lockMessage(minutes: number) {
  return `Too many attempts. For your security, please wait ${minutes} minute${minutes === 1 ? "" : "s"} and try again, or reset your password.`;
}

/** Stable key for an account, whichever way it's typed. */
function identityKey(identifier: string) {
  return identifier.includes("@") ? identifier.trim().toLowerCase() : (normalizeNigerianPhone(identifier) ?? identifier.trim());
}

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const { identifier, password } = parsed.data;

  const key = identityKey(identifier);
  const ip = await clientIp();
  const wait = await lockedFor("login", key, ip);
  if (wait) return { error: lockMessage(wait), values };

  const user = await db.user.findFirst({ where: identifier.includes("@") ? { email: key } : { phone: key } });
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) {
    await recordAttempt("login", key, ip, false);
    const nowLocked = await lockedFor("login", key, ip);
    return { error: nowLocked ? lockMessage(nowLocked) : "Incorrect email/phone or password", values };
  }
  if (user.status === "SUSPENDED") {
    return { error: "This account has been suspended. Contact SubNet support for help.", values };
  }
  after(() => clearFailures(key));

  await createSession({ uid: user.id, role: user.role, ver: user.sessionVersion });
  if (user.role === "CUSTOMER") await mergeGuestCart(user.id);
  redirect(safeNext(formData.get("next")) ?? ROLE_HOME[user.role]);
}

const RESET_SENT = "If an account matches, we've sent a reset link to its email address. Check your inbox (and spam folder).";

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = passwordResetRequest.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const key = identityKey(parsed.data.identifier);
  const ip = await clientIp();
  const wait = await lockedFor("reset", key, ip);
  if (wait) return { error: lockMessage(wait), values };
  await recordAttempt("reset", key, ip, true);

  const user = await db.user.findFirst({ where: key.includes("@") ? { email: key } : { phone: key } });
  // Same answer whether or not the account exists, so this can't be used to probe for accounts.
  if (user && user.status !== "SUSPENDED") {
    const token = await createResetToken(user.id);
    const url = `${await appUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    const email = {
      to: user.email,
      subject: "Reset your SubNet password",
      text: `Hi ${user.firstName},\n\nSomeone asked to reset the password for your SubNet account. Open this link to choose a new one (it works once, for ${RESET_TTL_MINUTES} minutes):\n\n${url}\n\nIf this wasn't you, ignore this email; your password won't change.`,
      html: emailLayout({
        heading: "Reset your password",
        paragraphs: [
          `Hi ${user.firstName},`,
          `Someone asked to reset the password for your SubNet account. The link works once, for ${RESET_TTL_MINUTES} minutes.`,
          "If this wasn't you, ignore this email; your password won't change.",
        ],
        button: { label: "Choose a new password", url },
      }),
    };
    after(() => sendEmail(email));
  }
  return { ok: RESET_SENT };
}

export async function completePasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = passwordReset.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const user = await resetPassword(parsed.data.token, parsed.data.password);
  if (!user) return { error: "This reset link has expired or was already used. Ask for a new one." };
  after(() =>
    Promise.all([
      logActivity({ actorId: user.id, action: "user.password_reset", targetType: "user", targetId: user.id }),
      clearFailures(user.email),
      clearFailures(user.phone),
      notify(user.id, "Password changed", "Your password was reset. If this wasn't you, contact SubNet support straight away."),
    ]),
  );
  await createSession({ uid: user.id, role: user.role, ver: user.sessionVersion });
  if (user.role === "CUSTOMER") await mergeGuestCart(user.id);
  redirect(ROLE_HOME[user.role]);
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
