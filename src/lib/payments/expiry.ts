import "server-only";
import { db } from "../db";
import { changeOrderStatus, OrderError } from "../orders";
import { PAYMENT_WINDOW_MINUTES } from "../order-rules";
import { verifyAndApply } from "./index";
import { paystackConfigured } from "./paystack";

/**
 * Cancels online orders that weren't paid in time and releases their stock.
 * Each pending attempt is checked with Paystack first, so a payment whose
 * webhook went missing is applied rather than lost.
 */
export async function expireStalePayments(now = new Date(), limit = 50) {
  const cutoff = new Date(now.getTime() - PAYMENT_WINDOW_MINUTES * 60_000);
  const stale = await db.order.findMany({
    where: { status: "AWAITING_PAYMENT", placedAt: { lt: cutoff } },
    include: { payments: { where: { status: "INITIALIZED" } } },
    orderBy: { placedAt: "asc" },
    take: limit,
  });
  let expired = 0;
  for (const order of stale) {
    if (paystackConfigured()) {
      for (const p of order.payments) {
        const r = await verifyAndApply(p.reference).catch(() => null);
        if (r?.outcome === "paid") break;
      }
    }
    try {
      await changeOrderStatus({
        orderId: order.id,
        actor: "SYSTEM",
        actorId: null,
        to: "CANCELLED",
        reason: `Payment wasn't completed within ${PAYMENT_WINDOW_MINUTES} minutes, so the order was cancelled and the items released.`,
      });
      await db.payment.updateMany({ where: { orderId: order.id, status: "INITIALIZED" }, data: { status: "FAILED", failureReason: "Not completed in time" } });
      expired++;
    } catch (err) {
      if (!(err instanceof OrderError)) throw err; // already paid or cancelled meanwhile
    }
  }
  return expired;
}

let lastRun = 0;

/** Cheap guard for calling from page renders via after(): at most once a minute per server instance. */
export async function expireStalePaymentsThrottled() {
  if (Date.now() - lastRun < 60_000) return;
  lastRun = Date.now();
  await expireStalePayments().catch((err) => console.error("expireStalePayments failed", err));
}
