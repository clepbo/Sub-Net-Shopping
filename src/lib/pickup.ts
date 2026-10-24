import "server-only";
// Pickup verification (PRD §13). Staff confirm collection only after the
// system matches the customer's QR token or PIN to a ready, uncollected
// order at their own store. Once collected the credential no longer works.
import { db } from "./db";
import { changeOrderStatus, OrderError } from "./orders";

export type PickupLookup =
  | { ok: true; orderId: string }
  | { ok: false; reason: string };

export async function findOrderForPickup(supermarketId: string, credential: { token?: string; pin?: string }): Promise<PickupLookup> {
  const token = credential.token?.trim();
  const pin = credential.pin?.replace(/\s/g, "");
  if (!token && !pin) return { ok: false, reason: "Scan the customer's QR code or enter their 6-digit PIN" };
  if (pin && !/^\d{6}$/.test(pin)) return { ok: false, reason: "The PIN is 6 digits" };

  const order = token
    ? await db.order.findUnique({ where: { pickupToken: token }, select: { id: true, supermarketId: true, status: true, fulfilment: true } })
    : await db.order.findFirst({
        where: { supermarketId, pickupPin: pin, status: { in: ["PLACED", "CONFIRMED", "READY_FOR_PICKUP"] } },
        select: { id: true, supermarketId: true, status: true, fulfilment: true },
      });
  if (!order) return { ok: false, reason: "No order matches this code. Check the PIN, or that the order hasn't already been collected." };
  if (order.supermarketId !== supermarketId) return { ok: false, reason: "This order is for a different supermarket." };
  if (order.status === "COLLECTED") return { ok: false, reason: "This order has already been collected. The code has expired." };
  if (order.status === "CANCELLED") return { ok: false, reason: "This order was cancelled." };
  if (order.status === "AWAITING_PAYMENT") return { ok: false, reason: "This order hasn't been paid for." };
  // The customer's PIN confirms a delivery at their door; it must never release a delivery order at the counter.
  if (order.fulfilment === "DELIVERY") return { ok: false, reason: "This is a delivery order. Only the assigned rider collects it." };
  return { ok: true, orderId: order.id };
}

/** Completes collection after re-checking the credential against the order. */
export async function completePickup(opts: { supermarketId: string; actorId: string; orderId: string; token?: string; pin?: string }) {
  const found = await findOrderForPickup(opts.supermarketId, { token: opts.token, pin: opts.pin });
  if (!found.ok) throw new OrderError(found.reason);
  if (found.orderId !== opts.orderId) throw new OrderError("The code doesn't match this order");
  const order = await db.order.findUniqueOrThrow({ where: { id: opts.orderId }, select: { status: true } });
  if (order.status !== "READY_FOR_PICKUP") throw new OrderError("Mark the order ready for pickup before handing it over");
  return changeOrderStatus({ orderId: opts.orderId, actor: "STORE", actorId: opts.actorId, to: "COLLECTED" });
}
