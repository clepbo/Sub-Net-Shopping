import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { PaymentMethod } from "@/generated/prisma/enums";
import { queueSms } from "./sms";

type Tx = Prisma.TransactionClient;

/** In-app notification for everyone at the store; returns their user IDs (e.g. for push). */
export async function notifyStoreStaff(tx: Tx, supermarketId: string, title: string, body: string) {
  const staff = await tx.supermarketStaff.findMany({ where: { supermarketId }, select: { userId: true } });
  if (staff.length) await tx.notification.createMany({ data: staff.map((s) => ({ userId: s.userId, title, body })) });
  return staff.map((s) => s.userId);
}

/** Tells the store about a new order it can act on (paid online, cash on delivery, or pay-at-store). */
export async function announceNewOrder(
  tx: Tx,
  order: { supermarketId: string; number: string; paymentMethod: PaymentMethod; fulfilment?: "PICKUP" | "DELIVERY" },
  itemCount: number,
) {
  const how = order.paymentMethod === "ONLINE" ? "Paid online" : order.paymentMethod === "CASH_ON_DELIVERY" ? "Cash on delivery" : "Customer pays at the store";
  const body = `${itemCount} item${itemCount === 1 ? "" : "s"} for ${order.fulfilment === "DELIVERY" ? "delivery" : "pickup"}. ${how}. Confirm it from your Orders page.`;
  const store = await tx.supermarket.findUnique({ where: { id: order.supermarketId }, select: { phone: true } });
  // An SMS to the store's phone, so a new order isn't missed when no one has the dashboard open.
  if (store?.phone) queueSms({ phones: [store.phone] }, `SubNet: New order ${order.number}. ${body}`);
  return notifyStoreStaff(tx, order.supermarketId, `New order ${order.number}`, body);
}
