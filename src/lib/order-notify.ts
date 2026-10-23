import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { PaymentMethod } from "@/generated/prisma/enums";

type Tx = Prisma.TransactionClient;

export async function notifyStoreStaff(tx: Tx, supermarketId: string, title: string, body: string) {
  const staff = await tx.supermarketStaff.findMany({ where: { supermarketId }, select: { userId: true } });
  if (staff.length) await tx.notification.createMany({ data: staff.map((s) => ({ userId: s.userId, title, body })) });
}

/** Tells the store about a new order it can act on (paid online, or pay-at-store). */
export async function announceNewOrder(tx: Tx, order: { supermarketId: string; number: string; paymentMethod: PaymentMethod }, itemCount: number) {
  const how = order.paymentMethod === "ONLINE" ? "Paid online" : "Customer pays at the store";
  await notifyStoreStaff(
    tx,
    order.supermarketId,
    `New order ${order.number}`,
    `${itemCount} item${itemCount === 1 ? "" : "s"} for pickup. ${how}. Confirm it from your Orders page.`,
  );
}
