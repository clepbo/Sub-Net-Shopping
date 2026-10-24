"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formValues, type ActionState } from "@/lib/action-state";
import { customerAddress, fieldErrors } from "@/lib/validation";

const MAX_ADDRESSES = 10;

export async function saveAddress(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("CUSTOMER");
  const values = formValues(formData);
  const raw = Object.fromEntries(formData);
  if (!raw.latitude || !raw.longitude) return { fieldErrors: { latitude: "Pin the location on the map" }, values };
  const parsed = customerAddress.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  if ((await db.customerAddress.count({ where: { userId: user.id } })) >= MAX_ADDRESSES) {
    return { error: `You can save up to ${MAX_ADDRESSES} addresses. Remove one first.`, values };
  }
  await db.customerAddress.create({ data: { userId: user.id, ...parsed.data } });
  revalidatePath("/", "layout");
  const next = String(formData.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/account/addresses");
}

export async function deleteAddress(formData: FormData) {
  const user = await requireUser("CUSTOMER");
  await db.customerAddress.deleteMany({ where: { id: String(formData.get("addressId") ?? ""), userId: user.id } });
  revalidatePath("/", "layout");
}
