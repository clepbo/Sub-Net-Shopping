"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logActivity, notify } from "@/lib/activity";
import { saveSettings } from "@/lib/settings";
import { formValues, type ActionState } from "@/lib/action-state";
import { fieldErrors, platformSettings } from "@/lib/validation";

type Decision = "APPROVED" | "REJECTED" | "SUSPENDED";

/** Which decisions are allowed from each approval state (PRD §7, §15). */
const ALLOWED: Record<string, Decision[]> = {
  PENDING: ["APPROVED", "REJECTED"],
  APPROVED: ["SUSPENDED"],
  REJECTED: ["APPROVED"],
  SUSPENDED: ["APPROVED"], // reactivate
};

function parseDecision(formData: FormData) {
  const decision = String(formData.get("decision") ?? "") as Decision;
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300) || null;
  return { decision, reason };
}

const VERB: Record<Decision, string> = { APPROVED: "approved", REJECTED: "rejected", SUSPENDED: "suspended" };

export async function decideSupermarket(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireUser("ADMIN");
  const id = String(formData.get("id") ?? "");
  const { decision, reason } = parseDecision(formData);
  const store = await db.supermarket.findUnique({ where: { id } });
  if (!store) return { error: "Supermarket not found" };
  if (!ALLOWED[store.status]?.includes(decision)) return { error: `Can't change a ${store.status.toLowerCase()} supermarket to ${decision.toLowerCase()}` };
  if (decision !== "APPROVED" && !reason) return { error: "Give a reason so the supermarket knows what to fix" };

  await db.supermarket.update({
    where: { id },
    data: {
      status: decision,
      statusReason: decision === "APPROVED" ? null : reason,
      ...(decision === "APPROVED" && !store.approvedAt ? { approvedAt: new Date() } : {}),
    },
  });
  const verb = store.status === "SUSPENDED" && decision === "APPROVED" ? "reactivated" : VERB[decision];
  await logActivity({ actorId: admin.id, action: `supermarket.${verb}`, targetType: "supermarket", targetId: id, details: reason ?? store.name });
  await notify(
    store.ownerId,
    `Your supermarket was ${verb}`,
    decision === "APPROVED" ? `${store.name} is now visible to customers on Sub Net.` : `Reason: ${reason}`,
  );
  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
  return { ok: `${store.name} ${verb}` };
}

export async function decideRider(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireUser("ADMIN");
  const id = String(formData.get("id") ?? "");
  const { decision, reason } = parseDecision(formData);
  const rider = await db.rider.findUnique({ where: { id }, include: { user: true } });
  if (!rider) return { error: "Rider not found" };
  if (!ALLOWED[rider.status]?.includes(decision)) return { error: `Can't change a ${rider.status.toLowerCase()} rider to ${decision.toLowerCase()}` };
  if (decision !== "APPROVED" && !reason) return { error: "Give a reason so the rider knows what to fix" };

  await db.rider.update({
    where: { id },
    data: {
      status: decision,
      statusReason: decision === "APPROVED" ? null : reason,
      ...(decision !== "APPROVED" ? { isOnline: false } : {}),
      ...(decision === "APPROVED" && !rider.approvedAt ? { approvedAt: new Date() } : {}),
    },
  });
  const verb = rider.status === "SUSPENDED" && decision === "APPROVED" ? "reactivated" : VERB[decision];
  const name = `${rider.user.firstName} ${rider.user.lastName}`;
  await logActivity({ actorId: admin.id, action: `rider.${verb}`, targetType: "rider", targetId: id, details: reason ?? name });
  await notify(
    rider.userId,
    `Your rider account was ${verb}`,
    decision === "APPROVED" ? "You can now go online to receive deliveries." : `Reason: ${reason}`,
  );
  revalidatePath("/admin", "layout");
  return { ok: `${name} ${verb}` };
}

export async function setAccountStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireUser("ADMIN");
  const id = String(formData.get("id") ?? "");
  const status = formData.get("status") === "SUSPENDED" ? "SUSPENDED" : "ACTIVE";
  if (id === admin.id) return { error: "You can't change your own account status" };
  const user = await db.user.findUnique({ where: { id } });
  if (!user) return { error: "User not found" };

  await db.user.update({
    where: { id },
    // Suspending also revokes every session the user holds.
    data: { status, ...(status === "SUSPENDED" ? { sessionVersion: { increment: 1 } } : {}) },
  });
  if (status === "SUSPENDED" && user.role === "RIDER") {
    await db.rider.update({ where: { userId: id }, data: { isOnline: false } });
  }
  const verb = status === "SUSPENDED" ? "suspended" : "reactivated";
  await logActivity({ actorId: admin.id, action: `user.${verb}`, targetType: "user", targetId: id, details: user.email });
  revalidatePath("/admin", "layout");
  return { ok: `${user.firstName} ${user.lastName} ${verb}` };
}

export async function updatePlatformSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireUser("ADMIN");
  const values = formValues(formData);
  const parsed = platformSettings.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  await saveSettings(
    Object.fromEntries(Object.entries(parsed.data).map(([k, v]) => [k, String(v)])),
    admin.id,
  );
  await logActivity({
    actorId: admin.id,
    action: "settings.updated",
    details: `supermarket ${parsed.data.supermarketCommissionPercent}%, rider ${parsed.data.riderCommissionPercent}%, delivery ₦${parsed.data.deliveryBaseFee} + ₦${parsed.data.deliveryPerKm}/km up to ${parsed.data.deliveryMaxKm} km`,
  });
  revalidatePath("/admin/settings");
  return { ok: "Settings saved", values };
}
