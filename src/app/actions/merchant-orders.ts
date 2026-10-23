"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireMerchantStore } from "@/lib/supermarkets";
import { STORE_VISIBLE } from "@/lib/merchant-orders";
import { adjustOrderItem, changeOrderStatus, OrderError } from "@/lib/orders";
import { completePickup } from "@/lib/pickup";
import type { ActionState } from "@/lib/action-state";
import type { OrderStatus } from "@/generated/prisma/enums";

// Collection goes through completeCollection, which needs the pickup code.
const STORE_TARGETS: OrderStatus[] = ["CONFIRMED", "READY_FOR_PICKUP", "CANCELLED"];

/** Any staff member of the store may process its orders, even while it's suspended, so customers aren't stranded. */
async function storeOrder(orderId: string) {
  const { user, store } = await requireMerchantStore();
  const order = await db.order.findFirst({ where: { id: orderId, supermarketId: store.id, status: STORE_VISIBLE }, select: { id: true } });
  return { user, store, order };
}

export async function updateOrderStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const to = String(formData.get("to") ?? "") as OrderStatus;
  if (!STORE_TARGETS.includes(to)) return { error: "Unknown action" };
  const { user, order } = await storeOrder(String(formData.get("orderId") ?? ""));
  if (!order) return { error: "Order not found" };
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300) || null;
  try {
    await changeOrderStatus({ orderId: order.id, actor: "STORE", actorId: user.id, to, reason });
  } catch (err) {
    if (err instanceof OrderError) return { error: err.message };
    throw err;
  }
  revalidatePath("/merchant", "layout");
  return { ok: "Order updated" };
}

export async function adjustItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, store } = await requireMerchantStore();
  try {
    await adjustOrderItem({
      supermarketId: store.id,
      orderItemId: String(formData.get("orderItemId") ?? ""),
      quantity: Number.parseInt(String(formData.get("quantity") ?? ""), 10),
      actorId: user.id,
    });
  } catch (err) {
    if (err instanceof OrderError) return { error: err.message };
    throw err;
  }
  revalidatePath("/merchant", "layout");
  return { ok: "Item updated" };
}

/** Hands over an order after its pickup QR token or PIN has been checked. */
export async function completeCollection(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, store } = await requireMerchantStore();
  const orderId = String(formData.get("orderId") ?? "");
  let number: string;
  try {
    ({ number } = await completePickup({
      supermarketId: store.id,
      actorId: user.id,
      orderId,
      token: String(formData.get("token") ?? "") || undefined,
      pin: String(formData.get("pin") ?? "") || undefined,
    }));
  } catch (err) {
    if (err instanceof OrderError) return { error: err.message };
    throw err;
  }
  revalidatePath("/merchant", "layout");
  // The code is used up now, so show a confirmation rather than re-checking it.
  redirect(`/merchant/pickup?collected=${encodeURIComponent(number)}`);
}

/** Marks a confirmed order ready from the pickup screen. */
export async function markReadyForPickup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, order } = await storeOrder(String(formData.get("orderId") ?? ""));
  if (!order) return { error: "Order not found" };
  try {
    await changeOrderStatus({ orderId: order.id, actor: "STORE", actorId: user.id, to: "READY_FOR_PICKUP" });
  } catch (err) {
    if (err instanceof OrderError) return { error: err.message };
    throw err;
  }
  revalidatePath("/merchant", "layout");
  return { ok: "Marked ready" };
}
