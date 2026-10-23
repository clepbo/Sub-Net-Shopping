"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireEditableStore } from "@/lib/supermarkets";
import { logActivity } from "@/lib/activity";
import { deleteStoredFile, storeImage } from "@/lib/storage";
import { lagosTimeToday } from "@/lib/time";
import { formValues, type ActionState } from "@/lib/action-state";
import { clockTime, fieldErrors, operatingSchedule, posIntegration, supermarketProfile } from "@/lib/validation";

function refresh() {
  revalidatePath("/merchant", "layout");
  revalidatePath("/", "layout");
}

export async function updateStoreProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, store, blocked } = await requireEditableStore();
  const values = formValues(formData);
  if (blocked) return { error: blocked, values };
  const parsed = supermarketProfile.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  await db.supermarket.update({ where: { id: store.id }, data: parsed.data });
  await logActivity({ actorId: user.id, action: "supermarket.profile_updated", targetType: "supermarket", targetId: store.id });
  refresh();
  return { ok: "Store profile saved", values };
}

export async function updateSchedule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, store, blocked } = await requireEditableStore();
  const values = formValues(formData);
  if (blocked) return { error: blocked, values };

  const str = (k: string) => String(formData.get(k) ?? "");
  const parsed = operatingSchedule.safeParse({
    days: Array.from({ length: 7 }, (_, d) => ({
      isOpen: formData.get(`day${d}.isOpen`) === "on",
      opensAt: str(`day${d}.opensAt`),
      closesAt: str(`day${d}.closesAt`),
    })),
    lastOrderTime: str("lastOrderTime"),
    pickupEnabled: formData.get("pickupEnabled") === "on",
    pickupStart: str("pickupStart"),
    pickupEnd: str("pickupEnd"),
    deliveryEnabled: formData.get("deliveryEnabled") === "on",
    deliveryStart: str("deliveryStart"),
    deliveryEnd: str("deliveryEnd"),
    lastDeliveryOrderTime: str("lastDeliveryOrderTime"),
  });
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    // Map days.N errors onto the day's row.
    for (const key of Object.keys(errors)) {
      const m = /^days\.(\d)/.exec(key);
      if (m) errors[`day${m[1]}`] = errors[key];
    }
    return { fieldErrors: errors, error: "Some hours need fixing — see the highlighted rows.", values };
  }
  const { days, ...rest } = parsed.data;

  await db.$transaction([
    db.supermarket.update({ where: { id: store.id }, data: rest }),
    ...days.map((day, dayOfWeek) =>
      db.supermarketHours.upsert({
        where: { supermarketId_dayOfWeek: { supermarketId: store.id, dayOfWeek } },
        create: { supermarketId: store.id, dayOfWeek, ...day, ...(day.isOpen ? {} : { opensAt: null, closesAt: null }) },
        update: { ...day, ...(day.isOpen ? {} : { opensAt: null, closesAt: null }) },
      }),
    ),
  ]);
  await logActivity({ actorId: user.id, action: "supermarket.hours_updated", targetType: "supermarket", targetId: store.id });
  refresh();
  return { ok: "Opening hours saved", values };
}

export async function setTemporaryClosure(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, store, blocked } = await requireEditableStore();
  if (blocked) return { error: blocked };
  const closed = formData.get("closed") === "true";
  const note = String(formData.get("note") ?? "").trim().slice(0, 200) || null;
  await db.supermarket.update({
    where: { id: store.id },
    data: { temporarilyClosed: closed, closureNote: closed ? note : null },
  });
  await logActivity({
    actorId: user.id,
    action: closed ? "supermarket.temporarily_closed" : "supermarket.reopened",
    targetType: "supermarket",
    targetId: store.id,
    details: note ?? undefined,
  });
  refresh();
  return { ok: closed ? "Store marked as temporarily closed" : "Store reopened" };
}

/**
 * Pauses or resumes pickup/delivery (PRD §19). `mode` is "30m", "1h",
 * "until" (with an HH:MM `until` field, today in Lagos time) or "resume".
 */
export async function setServicePause(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, store, blocked } = await requireEditableStore();
  if (blocked) return { error: blocked };
  const service = formData.get("service");
  if (service !== "delivery" && service !== "pickup") return { error: "Unknown service" };
  const mode = String(formData.get("mode") ?? "");
  const now = new Date();

  let until: Date | null;
  if (mode === "resume") until = null;
  else if (mode === "30m") until = new Date(now.getTime() + 30 * 60_000);
  else if (mode === "1h") until = new Date(now.getTime() + 60 * 60_000);
  else if (mode === "until") {
    const time = clockTime.safeParse(String(formData.get("until") ?? ""));
    if (!time.success) return { error: "Choose the time to pause until" };
    until = lagosTimeToday(now, time.data);
    if (until <= now) return { error: "That time has already passed today" };
  } else return { error: "Choose how long to pause for" };

  await db.supermarket.update({
    where: { id: store.id },
    data: service === "delivery" ? { deliveryPausedUntil: until } : { pickupPausedUntil: until },
  });
  await logActivity({
    actorId: user.id,
    action: until ? `supermarket.${service}_paused` : `supermarket.${service}_resumed`,
    targetType: "supermarket",
    targetId: store.id,
    details: until?.toISOString(),
  });
  refresh();
  const label = service === "delivery" ? "Delivery" : "Pickup";
  return { ok: until ? `${label} paused` : `${label} resumed` };
}

export async function uploadLogo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, store, blocked } = await requireEditableStore();
  if (blocked) return { error: blocked };
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image to upload" };

  let stored;
  try {
    stored = await storeImage(file, `supermarkets/${store.id}`);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Upload failed" };
  }
  await db.supermarket.update({ where: { id: store.id }, data: { logoUrl: stored.url } });
  if (store.logoUrl) await deleteStoredFile(store.logoUrl);
  await logActivity({ actorId: user.id, action: "supermarket.logo_updated", targetType: "supermarket", targetId: store.id });
  refresh();
  return { ok: "Logo updated" };
}

export async function updatePosIntegration(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, store, blocked } = await requireEditableStore();
  const values = formValues(formData);
  if (blocked) return { error: blocked, values };
  const parsed = posIntegration.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  await db.supermarket.update({ where: { id: store.id }, data: parsed.data });
  await logActivity({ actorId: user.id, action: "supermarket.pos_updated", targetType: "supermarket", targetId: store.id });
  refresh();
  return { ok: "POS details saved", values };
}
