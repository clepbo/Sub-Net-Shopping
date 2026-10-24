import "server-only";
import { db } from "./db";
import { notifyStoreStaff } from "./order-notify";
import { computeSettlement } from "./settlement-math";
import { COMPLETED_STATUSES } from "./order-rules";

/** Completed (collected or delivered) orders not yet in a settlement count towards the next one. */
const UNSETTLED = { status: { in: COMPLETED_STATUSES }, settlementId: null };

export async function unsettledSummary(supermarketId: string) {
  const orders = await db.order.findMany({
    where: { supermarketId, ...UNSETTLED },
    select: { totalKobo: true, deliveryFeeKobo: true, commissionKobo: true, paymentMethod: true },
  });
  return computeSettlement(orders);
}

/** Unsettled totals for every supermarket with collected orders. */
export async function unsettledByStore() {
  const rows = await db.order.groupBy({
    by: ["supermarketId", "paymentMethod"],
    where: UNSETTLED,
    _sum: { totalKobo: true, deliveryFeeKobo: true, commissionKobo: true },
    _count: true,
  });
  const stores = await db.supermarket.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.supermarketId))] } }, select: { id: true, name: true } });
  return stores
    .map((s) => {
      // Each row sums one payment method, so it settles like a single order of that type.
      const mine = rows.filter((r) => r.supermarketId === s.id);
      const sums = mine.map((r) => ({
        totalKobo: r._sum.totalKobo ?? 0,
        deliveryFeeKobo: r._sum.deliveryFeeKobo ?? 0,
        commissionKobo: r._sum.commissionKobo ?? 0,
        paymentMethod: r.paymentMethod,
      }));
      return { supermarket: s, ...computeSettlement(sums), orderCount: mine.reduce((n, r) => n + r._count, 0) };
    })
    .sort((a, b) => b.payableKobo - a.payableKobo);
}

/** Groups a store's unsettled collected orders into a settlement statement. */
export async function createSettlement(supermarketId: string, adminId: string) {
  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Order" WHERE "supermarketId" = ${supermarketId} AND "status" IN ('COLLECTED', 'DELIVERED') AND "settlementId" IS NULL FOR UPDATE`;
    if (locked.length === 0) return null;
    const orders = await tx.order.findMany({
      where: { id: { in: locked.map((o) => o.id) } },
      select: { id: true, totalKobo: true, deliveryFeeKobo: true, commissionKobo: true, paymentMethod: true },
    });
    const totals = computeSettlement(orders);
    const settlement = await tx.settlement.create({ data: { supermarketId, createdById: adminId, ...totals } });
    await tx.order.updateMany({ where: { id: { in: orders.map((o) => o.id) } }, data: { settlementId: settlement.id } });
    await notifyStoreStaff(tx, supermarketId, "New settlement statement", `A statement for ${totals.orderCount} completed orders is ready on your Earnings page.`);
    return settlement;
  });
}

export async function markSettlementPaid(settlementId: string, transferReference: string) {
  const s = await db.settlement.update({
    where: { id: settlementId, status: "PENDING" },
    data: { status: "PAID", paidAt: new Date(), transferReference },
  });
  await db.$transaction((tx) =>
    notifyStoreStaff(tx, s.supermarketId, "Settlement paid", `Settlement ${s.id.slice(-8).toUpperCase()} was marked paid. Reference: ${transferReference}.`),
  );
  return s;
}
