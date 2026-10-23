"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRider } from "@/lib/riders";
import { logActivity } from "@/lib/activity";
import { formValues, type ActionState } from "@/lib/action-state";
import { fieldErrors, vehicleDetails } from "@/lib/validation";

export async function setOnline(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, rider } = await requireRider();
  const online = formData.get("online") === "true";
  // Only approved riders can take deliveries, so only they can go online.
  if (online && rider.status !== "APPROVED") return { error: "You can go online once your account is approved." };
  await db.rider.update({
    where: { id: rider.id },
    data: { isOnline: online, ...(online ? { lastOnlineAt: new Date() } : {}) },
  });
  await logActivity({ actorId: user.id, action: online ? "rider.online" : "rider.offline", targetType: "rider", targetId: rider.id });
  revalidatePath("/rider");
  return { ok: online ? "You're online" : "You're offline" };
}

export async function updateVehicle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, rider } = await requireRider();
  const values = formValues(formData);
  if (rider.status === "SUSPENDED") return { error: "Your rider account is suspended.", values };
  const parsed = vehicleDetails.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  await db.rider.update({ where: { id: rider.id }, data: parsed.data });
  await logActivity({ actorId: user.id, action: "rider.vehicle_updated", targetType: "rider", targetId: rider.id });
  revalidatePath("/rider", "layout");
  return { ok: "Vehicle details saved", values };
}
