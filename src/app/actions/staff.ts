"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db";
import { requireEditableStore } from "@/lib/supermarkets";
import { hashPassword } from "@/lib/password";
import { logActivity, notify } from "@/lib/activity";
import { createResetToken, INVITE_TTL_MINUTES } from "@/lib/password-reset";
import { emailLayout, sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/app-url";
import { formValues, type ActionState } from "@/lib/action-state";
import { fieldErrors, staffInvite } from "@/lib/validation";
import { Prisma } from "@/generated/prisma/client";

async function sendInvite(user: { id: string; firstName: string; email: string }, storeName: string) {
  const token = await createResetToken(user.id, new Date(), INVITE_TTL_MINUTES);
  const link = `${await appUrl()}/reset-password?token=${encodeURIComponent(token)}&invite=1`;
  const email = {
    to: user.email,
    subject: `You've been added to ${storeName} on SubNet`,
    text: `Hi ${user.firstName},\n\nYou've been added as staff at ${storeName} on SubNet Shopping. Open this link to set your password and sign in (it works once, for 3 days):\n\n${link}`,
    html: emailLayout({
      heading: `Join ${storeName} on SubNet`,
      paragraphs: [`Hi ${user.firstName},`, `You've been added as staff at ${storeName}. Set your password to sign in. The link works once, for 3 days.`],
      button: { label: "Set my password", url: link },
    }),
  };
  after(() => sendEmail(email));
  return link;
}

export async function addStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, store, blocked } = await requireEditableStore();
  const values = formValues(formData);
  if (blocked) return { error: blocked, values };
  const parsed = staffInvite.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const d = parsed.data;

  const existing = await db.user.findFirst({ where: { OR: [{ email: d.email }, { phone: d.phone }] }, select: { email: true, phone: true } });
  if (existing) {
    return {
      fieldErrors: {
        ...(existing.email === d.email ? { email: "This email already has a SubNet account. Use a different email for the staff login." } : {}),
        ...(existing.phone === d.phone ? { phone: "This phone number already has a SubNet account." } : {}),
      },
      values,
    };
  }

  let staff;
  try {
    staff = await db.user.create({
      data: {
        role: "SUPERMARKET",
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email,
        phone: d.phone,
        // Unusable until they set their own password from the invite.
        passwordHash: await hashPassword(randomBytes(24).toString("base64url")),
        staffRoles: { create: { supermarketId: store.id, role: d.role } },
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return { error: "That email or phone number is already registered", values };
    throw err;
  }
  const link = await sendInvite(staff, store.name);
  after(() => logActivity({ actorId: user.id, action: "supermarket.staff_added", targetType: "user", targetId: staff.id, details: `${d.role} at ${store.name}` }));
  revalidatePath("/merchant/staff");
  return { ok: `${d.firstName} was added. We've emailed them a link to set their password.`, data: { link, name: d.firstName } };
}

/** Membership the signed-in manager may change: same store, not the owner, not themselves. */
async function editableMember(formData: FormData) {
  const ctx = await requireEditableStore();
  if (ctx.blocked) return { ...ctx, error: ctx.blocked, member: null };
  const member = await db.supermarketStaff.findFirst({
    where: { id: String(formData.get("memberId") ?? ""), supermarketId: ctx.store.id },
    include: { user: true },
  });
  if (!member) return { ...ctx, error: "Staff member not found", member: null };
  if (member.userId === ctx.store.ownerId) return { ...ctx, error: "The store owner can't be changed here", member: null };
  if (member.userId === ctx.user.id) return { ...ctx, error: "You can't change your own access", member: null };
  return { ...ctx, error: null, member };
}

export async function removeStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, store, error, member } = await editableMember(formData);
  if (!member) return { error: error ?? "Not allowed" };
  await db.$transaction([
    db.supermarketStaff.delete({ where: { id: member.id } }),
    // Staff logins only exist for this store, so the account is closed and signed out.
    db.user.update({ where: { id: member.userId }, data: { status: "SUSPENDED", sessionVersion: { increment: 1 } } }),
  ]);
  after(() => logActivity({ actorId: user.id, action: "supermarket.staff_removed", targetType: "user", targetId: member.userId, details: store.name }));
  revalidatePath("/merchant/staff");
  return { ok: `${member.user.firstName} can no longer sign in` };
}

export async function changeStaffRole(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, error, member } = await editableMember(formData);
  if (!member) return { error: error ?? "Not allowed" };
  const role = formData.get("role") === "MANAGER" ? "MANAGER" : "STAFF";
  await db.supermarketStaff.update({ where: { id: member.id }, data: { role } });
  after(() =>
    Promise.all([
      logActivity({ actorId: user.id, action: "supermarket.staff_role_changed", targetType: "user", targetId: member.userId, details: role }),
      notify(member.userId, "Your access changed", role === "MANAGER" ? "You're now a store manager." : "You're now store staff."),
    ]),
  );
  revalidatePath("/merchant/staff");
  return { ok: `${member.user.firstName} is now ${role === "MANAGER" ? "a manager" : "staff"}` };
}

export async function resendStaffInvite(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { store, error, member } = await editableMember(formData);
  if (!member) return { error: error ?? "Not allowed" };
  const link = await sendInvite(member.user, store.name);
  return { ok: `New link sent to ${member.user.email}`, data: { link, name: member.user.firstName } };
}
