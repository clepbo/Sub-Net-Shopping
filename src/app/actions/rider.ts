"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRider } from "@/lib/riders";
import { acceptDelivery, activeAssignment, completeDelivery, markPickedUp, recordLocation, releaseDelivery } from "@/lib/deliveries";
import { OrderError } from "@/lib/orders";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import { formValues, type ActionState } from "@/lib/action-state";
import { fieldErrors, vehicleDetails } from "@/lib/validation";

export async function setOnline(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, rider } = await requireRider();
  const online = formData.get("online") === "true";
  // Only approved riders can take deliveries, so only they can go online.
  if (online && rider.status !== "APPROVED") return { error: "You can go online once your account is approved." };
  if (!online && (await activeAssignment(rider.id))) return { error: "Finish your current delivery before going offline." };
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

async function riderStep(fn: () => Promise<unknown>, ok: string): Promise<ActionState> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof OrderError) return { error: err.message };
    throw err;
  }
  revalidatePath("/rider", "layout");
  return { ok };
}

export async function acceptDeliveryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { rider } = await requireRider();
  let assignmentId: string;
  try {
    assignmentId = (await acceptDelivery(rider, String(formData.get("orderId") ?? ""))).id;
  } catch (err) {
    if (err instanceof OrderError) return { error: err.message };
    throw err;
  }
  revalidatePath("/rider", "layout");
  redirect(`/rider/deliveries/${assignmentId}`);
}

export async function releaseDeliveryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { rider } = await requireRider();
  const result = await riderStep(() => releaseDelivery(rider, String(formData.get("assignmentId") ?? "")), "Delivery handed back");
  if (result.error) return result;
  redirect("/rider");
}

export async function pickedUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { rider } = await requireRider();
  return riderStep(() => markPickedUp(rider, String(formData.get("assignmentId") ?? "")), "Picked up. Head to the customer.");
}

export async function completeDeliveryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { rider } = await requireRider();
  return riderStep(
    () => completeDelivery(rider, String(formData.get("assignmentId") ?? ""), String(formData.get("pin") ?? "")),
    "Delivered! Your earning is now payable.",
  );
}

/** Called from the rider's phone every few seconds while online. */
export async function shareLocation(lat: number, lng: number) {
  const { rider } = await requireRider();
  if (rider.status !== "APPROVED" || !rider.isOnline) return;
  await recordLocation(rider, lat, lng);
}
