"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/app-url";
import { changeOrderStatus, OrderError, placeOrder } from "@/lib/orders";
import { PaymentError, startOnlinePayment } from "@/lib/payments";
import type { ActionState } from "@/lib/action-state";

export async function checkout(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("CUSTOMER");
  const supermarketId = String(formData.get("supermarketId") ?? "");
  const checkoutKey = String(formData.get("checkoutKey") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(checkoutKey)) return { error: "Please reload the page and try again." };
  const note = String(formData.get("note") ?? "").trim().slice(0, 300) || null;
  const paymentMethod = formData.get("paymentMethod") === "ONLINE" ? "ONLINE" : "PAY_AT_STORE";

  let orderId: string;
  try {
    orderId = await placeOrder({ customerId: user.id, supermarketId, checkoutKey, note, paymentMethod });
  } catch (err) {
    if (err instanceof OrderError) return { error: err.message };
    throw err;
  }
  revalidatePath("/", "layout");
  if (paymentMethod === "PAY_AT_STORE") redirect(`/orders/${orderId}?placed=1`);

  let payUrl: string;
  try {
    payUrl = await startOnlinePayment({ orderId, customerId: user.id, appUrl: await appUrl() });
  } catch (err) {
    if (err instanceof PaymentError) redirect(`/orders/${orderId}?payment=error`);
    throw err;
  }
  redirect(payUrl);
}

/** Retries payment for an unpaid online order. */
export async function payNow(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("CUSTOMER");
  let payUrl: string;
  try {
    payUrl = await startOnlinePayment({ orderId: String(formData.get("orderId") ?? ""), customerId: user.id, appUrl: await appUrl() });
  } catch (err) {
    if (err instanceof PaymentError) return { error: err.message };
    throw err;
  }
  redirect(payUrl);
}

export async function cancelMyOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("CUSTOMER");
  const order = await db.order.findFirst({ where: { id: String(formData.get("orderId") ?? ""), customerId: user.id }, select: { id: true } });
  if (!order) return { error: "Order not found" };
  try {
    await changeOrderStatus({ orderId: order.id, actor: "CUSTOMER", actorId: user.id, to: "CANCELLED" });
  } catch (err) {
    if (err instanceof OrderError) return { error: err.message };
    throw err;
  }
  revalidatePath("/", "layout");
  return { ok: "Order cancelled" };
}
