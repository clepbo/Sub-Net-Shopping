import "server-only";
import { db } from "./db";
import type { OrderStatus } from "@/generated/prisma/enums";

/** Orders a supermarket can see: unpaid online orders stay hidden until paid. */
export const STORE_VISIBLE = { not: "AWAITING_PAYMENT" } as const;

/** Queue tabs for the merchant order screen. */
export const ORDER_TABS: { key: string; label: string; statuses: OrderStatus[] }[] = [
  { key: "new", label: "New", statuses: ["PLACED"] },
  { key: "preparing", label: "Preparing", statuses: ["CONFIRMED"] },
  { key: "ready", label: "Ready", statuses: ["READY_FOR_PICKUP"] },
  { key: "done", label: "Completed", statuses: ["COLLECTED"] },
  { key: "cancelled", label: "Cancelled", statuses: ["CANCELLED"] },
];

export async function orderCounts(supermarketId: string) {
  const rows = await db.order.groupBy({ by: ["status"], where: { supermarketId, status: { not: "AWAITING_PAYMENT" } }, _count: true });
  const counts = { AWAITING_PAYMENT: 0, PLACED: 0, CONFIRMED: 0, READY_FOR_PICKUP: 0, COLLECTED: 0, CANCELLED: 0 } satisfies Record<OrderStatus, number>;
  for (const r of rows) counts[r.status] = r._count;
  return counts;
}
