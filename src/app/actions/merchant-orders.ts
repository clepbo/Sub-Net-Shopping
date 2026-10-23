"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireMerchantStore } from "@/lib/supermarkets";
import { adjustOrderItem, changeOrderStatus, OrderError } from "@/lib/orders";
import type { ActionState } from "@/lib/action-state";
import type { OrderStatus } from "@/generated/prisma/enums";

const STORE_TARGETS: OrderStatus[] = ["CONFIRMED", "READY_FOR_PICKUP", "COLLECTED", "CANCELLED"];

/** Any staff member of the store may process its orders, even while it's suspended, so customers aren't stranded. */
async function storeOrder(orderId: string) {
  const { user, store } = await requireMerchantStore();
  const order = await db.order.findFirst({ where: { id: orderId, supermarketId: store.id }, select: { id: true } });
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
