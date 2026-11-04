import "server-only";
import { db } from "./db";
import { describePickupTime, REMINDER_LEAD_MINUTES } from "./pickup-slots";
import { sendPush } from "./push";

/**
 * Reminds customers of their chosen pickup time about an hour before.
 * Each order is claimed with a conditional update, so overlapping runs
 * never send the same reminder twice.
 */
export async function sendPickupReminders(now = new Date()) {
  const due = await db.order.findMany({
    where: {
      fulfilment: "PICKUP",
      status: { in: ["PLACED", "CONFIRMED", "READY_FOR_PICKUP"] },
      pickupReminderSentAt: null,
      pickupAt: { lte: new Date(now.getTime() + REMINDER_LEAD_MINUTES * 60_000), gte: new Date(now.getTime() - 30 * 60_000) },
    },
    include: { supermarket: { select: { name: true } } },
    take: 200,
  });
  let sent = 0;
  for (const o of due) {
    const claimed = await db.order.updateMany({ where: { id: o.id, pickupReminderSentAt: null }, data: { pickupReminderSentAt: now } });
    if (claimed.count === 0) continue;
    const when = describePickupTime(o.pickupAt!, now);
    const title = `Pickup reminder: ${when}`;
    const body = `Collect order ${o.number} at ${o.supermarket.name}. Show your QR code or PIN at the pickup point${o.paymentStatus === "PAID" ? "" : " and pay there"}.`;
    await db.notification.create({ data: { userId: o.customerId, title, body } });
    await sendPush([o.customerId], { title, body, url: `/orders/${o.id}` });
    sent++;
  }
  return sent;
}
