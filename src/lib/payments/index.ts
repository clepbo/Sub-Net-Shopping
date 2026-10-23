import "server-only";
// Online payments for orders (Paystack). A payment is applied to its order
// exactly once, whether the success arrives through the browser redirect,
// the webhook, or the expiry check, by locking the payment row and stamping
// processedAt.
import { randomBytes } from "node:crypto";
import { db } from "../db";
import { announceNewOrder } from "../order-notify";
import { PAYMENT_WINDOW_MINUTES } from "../order-rules";
import { reserveStock } from "../stock";
import { createRefund, initializeTransaction, PaystackError, verifyTransaction, type PaystackTransaction } from "./paystack";

export class PaymentError extends Error {}

export function paymentDeadline(placedAt: Date) {
  return new Date(placedAt.getTime() + PAYMENT_WINDOW_MINUTES * 60_000);
}

/** Starts (or restarts) payment for an unpaid online order; returns Paystack's checkout URL. */
export async function startOnlinePayment(opts: { orderId: string; customerId: string; appUrl: string }) {
  const order = await db.order.findFirst({
    where: { id: opts.orderId, customerId: opts.customerId },
    include: { customer: { select: { email: true } } },
  });
  if (!order) throw new PaymentError("Order not found");
  if (order.status !== "AWAITING_PAYMENT") throw new PaymentError("This order doesn't need paying");
  if (paymentDeadline(order.placedAt) < new Date()) throw new PaymentError("The time to pay for this order has run out. Please place it again.");

  const reference = `${order.number}-${randomBytes(4).toString("hex")}`;
  const payment = await db.payment.create({ data: { orderId: order.id, reference, amountKobo: order.totalKobo } });
  try {
    const init = await initializeTransaction({
      email: order.customer.email,
      amountKobo: order.totalKobo,
      reference,
      callbackUrl: `${opts.appUrl}/payments/paystack/callback`,
      metadata: { orderId: order.id, orderNumber: order.number },
    });
    return init.authorization_url;
  } catch (err) {
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: err instanceof Error ? err.message : String(err) } });
    throw new PaymentError(err instanceof PaystackError ? "We couldn't start the payment. Please try again." : "Payment failed to start");
  }
}

type ApplyOutcome = "paid" | "restored" | "already-processed" | "pending" | "failed" | "refunded" | "unknown";

/**
 * Applies a transaction result that came from Paystack's verify endpoint.
 * Never trust a redirect or webhook body on its own: callers verify first.
 */
export async function applyVerifiedTransaction(tx: PaystackTransaction): Promise<{ outcome: ApplyOutcome; orderId?: string }> {
  const payment = await db.payment.findUnique({ where: { reference: tx.reference } });
  if (!payment) return { outcome: "unknown" };
  if (payment.processedAt) return { outcome: "already-processed", orderId: payment.orderId };

  if (tx.status !== "success") {
    if (["failed", "abandoned", "reversed"].includes(tx.status)) {
      await db.payment.updateMany({ where: { id: payment.id, status: "INITIALIZED" }, data: { status: "FAILED", failureReason: tx.gateway_response ?? tx.status } });
      return { outcome: "failed", orderId: payment.orderId };
    }
    return { outcome: "pending", orderId: payment.orderId };
  }

  const amountOk = tx.amount === payment.amountKobo && tx.currency === "NGN";
  const result = await db.$transaction(async (t) => {
    await t.$queryRaw`SELECT 1 FROM "Payment" WHERE "id" = ${payment.id} FOR UPDATE`;
    const fresh = await t.payment.findUniqueOrThrow({ where: { id: payment.id } });
    if (fresh.processedAt) return { outcome: "already-processed" as const, refundKobo: 0 };
    await t.payment.update({
      where: { id: payment.id },
      data: {
        status: "SUCCEEDED",
        processedAt: new Date(),
        paidAt: tx.paid_at ? new Date(tx.paid_at) : new Date(),
        channel: tx.channel ?? null,
        providerTransactionId: String(tx.id),
        ...(amountOk ? {} : { failureReason: `Paid ${tx.amount} ${tx.currency}, expected ${payment.amountKobo} NGN` }),
      },
    });
    // The wrong amount never confirms an order; it's refunded in full.
    if (!amountOk) return { outcome: "refunded" as const, refundKobo: tx.amount };

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
        return { outcome: "refunded" as const, refundKobo: tx.amount };
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
      return { outcome: "refunded" as const, refundKobo: tx.amount };
    }

    await t.notification.create({
      data: { userId: order.customerId, title: `Payment received for ${order.number}`, body: "Your order has been sent to the supermarket. We'll tell you when it's ready to collect." },
    });
    await announceNewOrder(t, order, order.items.length);
    return { outcome: order.status === "AWAITING_PAYMENT" ? ("paid" as const) : ("restored" as const), refundKobo: 0 };
  });

  if (result.refundKobo > 0) await refundPayment(payment.id, result.refundKobo, "Payment couldn't be applied to the order");
  return { outcome: result.outcome, orderId: payment.orderId };
}

/** Verifies a reference with Paystack and applies the result. */
export async function verifyAndApply(reference: string) {
  return applyVerifiedTransaction(await verifyTransaction(reference));
}

/** Asks Paystack to refund part or all of a payment, recording the attempt. */
export async function refundPayment(paymentId: string, amountKobo: number, reason: string) {
  const payment = await db.payment.findUniqueOrThrow({ where: { id: paymentId } });
  const refund = await db.refund.create({ data: { paymentId, amountKobo, reason } });
  await sendRefund(refund.id, payment.reference, amountKobo, reason);
  await syncRefundedStatus(payment.orderId);
  return refund.id;
}

async function sendRefund(refundId: string, reference: string, amountKobo: number, reason: string) {
  try {
    const res = await createRefund({ reference, amountKobo, note: reason });
    await db.refund.update({ where: { id: refundId }, data: { providerRefundId: String(res.id), status: res.status === "processed" ? "PROCESSED" : "PENDING", error: null } });
  } catch (err) {
    // Left for an admin to retry from the Payments page.
    await db.refund.update({ where: { id: refundId }, data: { status: "FAILED", error: err instanceof Error ? err.message : String(err) } });
  }
}

export async function retryRefund(refundId: string) {
  const refund = await db.refund.findUniqueOrThrow({ where: { id: refundId }, include: { payment: true } });
  if (refund.status !== "FAILED") return;
  await db.refund.update({ where: { id: refundId }, data: { status: "PENDING", error: null } });
  await sendRefund(refund.id, refund.payment.reference, refund.amountKobo, refund.reason);
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
