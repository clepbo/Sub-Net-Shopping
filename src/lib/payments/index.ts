import "server-only";
// Online payments for orders (Monnify or Paystack). A payment is applied to its order
// exactly once, whether the success arrives through the browser redirect,
// the webhook, or the expiry check, by locking the payment row and stamping
// processedAt.
import { randomBytes } from "node:crypto";
import { db } from "../db";
import { announceNewOrder } from "../order-notify";
import { queuePush } from "../push";
import { PAYMENT_WINDOW_MINUTES } from "../order-rules";
import { reserveStock } from "../stock";
import { activeProvider, initializePayment, sendProviderRefund, verifyPayment, type VerifiedTransaction } from "./gateway";

export class PaymentError extends Error {}

export function paymentDeadline(placedAt: Date) {
  return new Date(placedAt.getTime() + PAYMENT_WINDOW_MINUTES * 60_000);
}

/** Starts (or restarts) payment for an unpaid online order; returns the provider's checkout URL. */
export async function startOnlinePayment(opts: { orderId: string; customerId: string; appUrl: string }) {
  const provider = activeProvider();
  if (!provider) throw new PaymentError("Online payment isn't available right now");
  const order = await db.order.findFirst({
    where: { id: opts.orderId, customerId: opts.customerId },
    include: { customer: { select: { email: true, firstName: true, lastName: true } }, supermarket: { select: { name: true } } },
  });
  if (!order) throw new PaymentError("Order not found");
  if (order.status !== "AWAITING_PAYMENT") throw new PaymentError("This order doesn't need paying");
  if (paymentDeadline(order.placedAt) < new Date()) throw new PaymentError("The time to pay for this order has run out. Please place it again.");

  const reference = `${order.number}-${randomBytes(4).toString("hex")}`;
  const payment = await db.payment.create({ data: { orderId: order.id, reference, amountKobo: order.totalKobo, provider } });
  try {
    return await initializePayment(provider, {
      reference,
      amountKobo: order.totalKobo,
      email: order.customer.email,
      customerName: `${order.customer.firstName} ${order.customer.lastName}`,
      description: `SubNet order ${order.number} from ${order.supermarket.name}`,
      callbackBase: opts.appUrl,
      metadata: { orderId: order.id, orderNumber: order.number },
    });
  } catch (err) {
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: err instanceof Error ? err.message : String(err) } });
    throw new PaymentError("We couldn't start the payment. Please try again.");
  }
}

type ApplyOutcome = "paid" | "restored" | "already-processed" | "pending" | "failed" | "refunded" | "unknown";

/**
 * Applies a transaction result that came from the provider's verify endpoint.
 * Never trust a redirect or webhook body on its own: callers verify first.
 */
export async function applyVerifiedTransaction(tx: VerifiedTransaction): Promise<{ outcome: ApplyOutcome; orderId?: string }> {
  const payment = await db.payment.findUnique({ where: { reference: tx.reference } });
  if (!payment) return { outcome: "unknown" };
  if (payment.processedAt) return { outcome: "already-processed", orderId: payment.orderId };

  if (tx.status !== "success") {
    if (tx.status === "failed") {
      await db.payment.updateMany({ where: { id: payment.id, status: "INITIALIZED" }, data: { status: "FAILED", failureReason: tx.detail ?? tx.status } });
      return { outcome: "failed", orderId: payment.orderId };
    }
    return { outcome: "pending", orderId: payment.orderId };
  }

  const amountOk = tx.amountKobo === payment.amountKobo && tx.currency === "NGN";
  let staffToPush: string[] = [];
  let customerToPush: string | null = null;
  let orderNumber = "";
  const result = await db.$transaction(async (t) => {
    await t.$queryRaw`SELECT 1 FROM "Payment" WHERE "id" = ${payment.id} FOR UPDATE`;
    const fresh = await t.payment.findUniqueOrThrow({ where: { id: payment.id } });
    if (fresh.processedAt) return { outcome: "already-processed" as const, refundKobo: 0 };
    await t.payment.update({
      where: { id: payment.id },
      data: {
        status: "SUCCEEDED",
        processedAt: new Date(),
        paidAt: tx.paidAt ?? new Date(),
        channel: tx.channel,
        providerTransactionId: tx.providerTransactionId,
        ...(amountOk ? {} : { failureReason: `Paid ${tx.amountKobo} kobo ${tx.currency}, expected ${payment.amountKobo} NGN` }),
      },
    });
    // The wrong amount never confirms an order; it's refunded in full.
    if (!amountOk) return { outcome: "refunded" as const, refundKobo: tx.amountKobo };

    await t.$queryRaw`SELECT 1 FROM "Order" WHERE "id" = ${payment.orderId} FOR UPDATE`;
    const order = await t.order.findUniqueOrThrow({ where: { id: payment.orderId }, include: { items: true } });
    const how = tx.channel ? ` by ${tx.channel.replace(/_/g, " ")}` : "";

    if (order.status === "AWAITING_PAYMENT") {
      await t.order.update({ where: { id: order.id }, data: { status: "PLACED", paymentStatus: "PAID", paidAt: new Date() } });
      await t.orderEvent.create({ data: { orderId: order.id, status: "PLACED", note: `Payment received${how}` } });
    } else if (order.status === "CANCELLED" && order.paymentStatus === "UNPAID" && order.cancelReason?.startsWith("Payment wasn't completed")) {
      // Paid just after the payment window closed: restore the order if the stock is still there.
      const tracked = order.items.filter((i) => i.stockReserved && i.inventoryId);
      const listings = await t.inventory.findMany({ where: { id: { in: tracked.map((i) => i.inventoryId!) } }, select: { id: true, stockQuantity: true } });
      const enough = tracked.every((i) => (listings.find((l) => l.id === i.inventoryId)?.stockQuantity ?? 0) >= i.quantity);
      if (!enough) {
        await t.order.update({ where: { id: order.id }, data: { paymentStatus: "PAID", paidAt: new Date() } });
        await t.orderEvent.create({ data: { orderId: order.id, status: "CANCELLED", note: "Payment arrived after the order expired and items had sold out; refunding" } });
        return { outcome: "refunded" as const, refundKobo: tx.amountKobo };
      }
      for (const i of tracked) await reserveStock(t, i.inventoryId!, i.quantity, i.name);
      await t.order.update({
        where: { id: order.id },
        data: { status: "PLACED", paymentStatus: "PAID", paidAt: new Date(), cancelledAt: null, cancelReason: null },
      });
      await t.orderEvent.create({ data: { orderId: order.id, status: "PLACED", note: `Payment received${how} after the order expired; order restored` } });
    } else {
      // Already paid by another attempt, or cancelled for another reason: refund this one.
      await t.orderEvent.create({ data: { orderId: order.id, status: order.status, note: "Extra payment received; refunding it" } });
      return { outcome: "refunded" as const, refundKobo: tx.amountKobo };
    }

    await t.notification.create({
      data: { userId: order.customerId, title: `Payment received for ${order.number}`, body: "Your order has been sent to the supermarket. We'll tell you when it's ready to collect." },
    });
    staffToPush = await announceNewOrder(t, order, order.items.length);
    customerToPush = order.customerId;
    orderNumber = order.number;
    return { outcome: order.status === "AWAITING_PAYMENT" ? ("paid" as const) : ("restored" as const), refundKobo: 0 };
  });

  if (result.refundKobo > 0) await refundPayment(payment.id, result.refundKobo, "Payment couldn't be applied to the order");
  if (customerToPush) {
    queuePush([customerToPush], { title: `Payment received for ${orderNumber}`, body: "Your order has been sent to the supermarket.", url: `/orders/${payment.orderId}` });
    queuePush(staffToPush, { title: `New order ${orderNumber}`, body: "A new paid order is waiting. Confirm it from your Orders page.", url: `/merchant/orders/${payment.orderId}` });
  }
  return { outcome: result.outcome, orderId: payment.orderId };
}

/** Verifies a reference with the provider that took the payment, and applies the result. */
export async function verifyAndApply(reference: string) {
  const payment = await db.payment.findUnique({ where: { reference }, select: { provider: true } });
  if (!payment) return { outcome: "unknown" as const };
  return applyVerifiedTransaction(await verifyPayment(payment.provider, reference));
}

/** Asks the provider to refund part or all of a payment, recording the attempt. */
export async function refundPayment(paymentId: string, amountKobo: number, reason: string) {
  const payment = await db.payment.findUniqueOrThrow({ where: { id: paymentId } });
  const refund = await db.refund.create({ data: { paymentId, amountKobo, reason } });
  await sendRefund(refund.id, payment, amountKobo, reason);
  await syncRefundedStatus(payment.orderId);
  return refund.id;
}

async function sendRefund(
  refundId: string,
  payment: { provider: import("@/generated/prisma/enums").PaymentProvider; reference: string; providerTransactionId: string | null },
  amountKobo: number,
  reason: string,
) {
  try {
    const res = await sendProviderRefund(payment.provider, { refundId, reference: payment.reference, providerTransactionId: payment.providerTransactionId, amountKobo, reason });
    await db.refund.update({ where: { id: refundId }, data: { providerRefundId: res.providerRefundId, status: res.processed ? "PROCESSED" : "PENDING", error: null } });
  } catch (err) {
    // Left for an admin to retry from the Payments page.
    await db.refund.update({ where: { id: refundId }, data: { status: "FAILED", error: err instanceof Error ? err.message : String(err) } });
  }
}

export async function retryRefund(refundId: string) {
  const refund = await db.refund.findUniqueOrThrow({ where: { id: refundId }, include: { payment: true } });
  if (refund.status !== "FAILED") return;
  await db.refund.update({ where: { id: refundId }, data: { status: "PENDING", error: null } });
  await sendRefund(refund.id, refund.payment, refund.amountKobo, refund.reason);
}

/** Refunds `amountKobo` (or everything still refundable) of an order's online payments. */
export async function refundOrderBalance(orderId: string, reason: string, amountKobo?: number) {
  const payments = await db.payment.findMany({
    where: { orderId, status: "SUCCEEDED", failureReason: null },
    include: { refunds: { where: { status: { not: "FAILED" } } } },
    orderBy: { paidAt: "asc" },
  });
  let left = amountKobo ?? Infinity;
  for (const p of payments) {
    const refundable = p.amountKobo - p.refunds.reduce((n, r) => n + r.amountKobo, 0);
    const amount = Math.min(refundable, left);
    if (amount <= 0) continue;
    await refundPayment(p.id, amount, reason);
    left -= amount;
    if (left <= 0) break;
  }
}

/** Marks an order REFUNDED once everything paid online has been sent back. */
async function syncRefundedStatus(orderId: string) {
  const payments = await db.payment.findMany({
    where: { orderId, status: "SUCCEEDED" },
    include: { refunds: { where: { status: { not: "FAILED" } } } },
  });
  const paid = payments.reduce((n, p) => n + p.amountKobo, 0);
  const refunded = payments.reduce((n, p) => n + p.refunds.reduce((m, r) => m + r.amountKobo, 0), 0);
  if (paid > 0 && refunded >= paid) {
    await db.order.updateMany({ where: { id: orderId, paymentMethod: "ONLINE", status: "CANCELLED" }, data: { paymentStatus: "REFUNDED" } });
  }
}

/** Updates a refund from Paystack's refund.* webhook events. */
export async function applyRefundEvent(data: { id?: number | string; status?: string; transaction_reference?: string; amount?: number }) {
  const status = data.status === "processed" ? "PROCESSED" : data.status === "failed" ? "FAILED" : null;
  if (!status) return;
  const refund =
    (data.id !== undefined && (await db.refund.findFirst({ where: { providerRefundId: String(data.id) } }))) ||
    (data.transaction_reference &&
      (await db.refund.findFirst({
        where: { status: "PENDING", payment: { reference: data.transaction_reference }, ...(data.amount ? { amountKobo: data.amount } : {}) },
        orderBy: { createdAt: "asc" },
      })));
  if (refund) await db.refund.update({ where: { id: refund.id }, data: { status, ...(status === "FAILED" ? { error: "Paystack reported the refund failed" } : {}) } });
}

/** Updates a refund from Monnify's SUCCESSFUL_REFUND / FAILED_REFUND webhook events (refundReference is our refund id). */
export async function applyMonnifyRefundEvent(eventType: string, data: { refundReference?: string; refundStatus?: string }) {
  if (!data.refundReference) return;
  const status = eventType === "SUCCESSFUL_REFUND" ? "PROCESSED" : eventType === "FAILED_REFUND" ? "FAILED" : null;
  if (!status) return;
  await db.refund.updateMany({
    where: { id: data.refundReference, status: { not: status } },
    data: { status, ...(status === "FAILED" ? { error: "Monnify reported the refund failed" } : {}) },
  });
}
