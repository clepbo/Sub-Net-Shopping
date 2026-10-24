import "server-only";
import { db } from "./db";
import type { ApprovalStatus } from "@/generated/prisma/enums";

export const APPROVAL_STATUSES: ApprovalStatus[] = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"];

export function parseApprovalStatus(value: string | undefined): ApprovalStatus | undefined {
  return APPROVAL_STATUSES.find((s) => s === value);
}

/** Dashboard counts (PRD §21) — always from the live database. */
export async function platformStats() {
  const startOfToday = new Date();
  startOfToday.setTime(startOfToday.getTime() - ((startOfToday.getTime() + 3_600_000) % 86_400_000)); // midnight in Lagos (UTC+1)
  const [customers, supermarketsByStatus, ridersByStatus, activeRiders, suspendedAccounts, products, listings, ordersToday, openOrders, collected] = await Promise.all([
    db.user.count({ where: { role: "CUSTOMER" } }),
    db.supermarket.groupBy({ by: ["status"], _count: true }),
    db.rider.groupBy({ by: ["status"], _count: true }),
    db.rider.count({ where: { isOnline: true, status: "APPROVED", user: { status: "ACTIVE" } } }),
    db.user.count({ where: { status: "SUSPENDED" } }),
    db.product.count(),
    db.inventory.count(),
    db.order.count({ where: { placedAt: { gte: startOfToday } } }),
    db.order.count({ where: { status: { in: ["PLACED", "CONFIRMED", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"] } } }),
    db.order.aggregate({ where: { status: { in: ["COLLECTED", "DELIVERED"] } }, _sum: { totalKobo: true }, _count: true }),
  ]);
  const tally = (rows: { status: ApprovalStatus; _count: number }[]) => {
    const out = Object.fromEntries(APPROVAL_STATUSES.map((s) => [s, 0])) as Record<ApprovalStatus, number>;
    for (const r of rows) out[r.status] = r._count;
    return { ...out, total: rows.reduce((n, r) => n + r._count, 0) };
  };
  return {
    customers,
    supermarkets: tally(supermarketsByStatus),
    riders: tally(ridersByStatus),
    activeRiders,
    suspendedAccounts,
    products,
    listings,
    ordersToday,
    openOrders,
    collectedOrders: collected._count,
    collectedValueKobo: collected._sum.totalKobo ?? 0,
  };
}
