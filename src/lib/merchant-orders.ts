import "server-only";
import { db } from "./db";
import type { OrderStatus } from "@/generated/prisma/enums";

/** Queue tabs for the merchant order screen. */
export const ORDER_TABS: { key: string; label: string; statuses: OrderStatus[] }[] = [
  { key: "new", label: "New", statuses: ["PLACED"] },
  { key: "preparing", label: "Preparing", statuses: ["CONFIRMED"] },
  { key: "ready", label: "Ready", statuses: ["READY_FOR_PICKUP"] },
  { key: "done", label: "Completed", statuses: ["COLLECTED"] },
  { key: "cancelled", label: "Cancelled", statuses: ["CANCELLED"] },
];

export async function orderCounts(supermarketId: string) {
  const rows = await db.order.groupBy({ by: ["status"], where: { supermarketId }, _count: true });
  const by = (s: OrderStatus) => rows.find((r) => r.status === s)?._count ?? 0;
  return { PLACED: by("PLACED"), CONFIRMED: by("CONFIRMED"), READY_FOR_PICKUP: by("READY_FOR_PICKUP"), COLLECTED: by("COLLECTED"), CANCELLED: by("CANCELLED") };
}
