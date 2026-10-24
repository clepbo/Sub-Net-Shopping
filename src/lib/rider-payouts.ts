import "server-only";
import { db } from "./db";

/** Completed deliveries whose earnings haven't been paid out, per rider. */
export async function riderBalances() {
  const rows = await db.deliveryAssignment.groupBy({
    by: ["riderId"],
    where: { earningStatus: "ELIGIBLE", payoutId: null },
    _sum: { riderEarningKobo: true, deliveryFeeKobo: true, riderCommissionKobo: true },
    _count: true,
  });
  const riders = await db.rider.findMany({ where: { id: { in: rows.map((r) => r.riderId) } }, include: { user: { select: { firstName: true, lastName: true } } } });
  return rows
    .map((r) => ({
      rider: riders.find((x) => x.id === r.riderId)!,
      deliveries: r._count,
      feesKobo: r._sum.deliveryFeeKobo ?? 0,
      commissionKobo: r._sum.riderCommissionKobo ?? 0,
      amountKobo: r._sum.riderEarningKobo ?? 0,
    }))
    .sort((a, b) => b.amountKobo - a.amountKobo);
}

export async function riderEarningsSummary(riderId: string) {
  const rows = await db.deliveryAssignment.groupBy({ by: ["earningStatus"], where: { riderId }, _sum: { riderEarningKobo: true }, _count: true });
  const by = (s: string) => rows.find((r) => r.earningStatus === s);
  return {
    pendingKobo: by("PENDING")?._sum.riderEarningKobo ?? 0,
    eligibleKobo: by("ELIGIBLE")?._sum.riderEarningKobo ?? 0,
    paidKobo: by("PAID")?._sum.riderEarningKobo ?? 0,
    completed: (by("ELIGIBLE")?._count ?? 0) + (by("PAID")?._count ?? 0),
  };
}

/** Bundles a rider's payable earnings into a payout to transfer. */
export async function createRiderPayout(riderId: string, adminId: string) {
  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "DeliveryAssignment" WHERE "riderId" = ${riderId} AND "earningStatus" = 'ELIGIBLE' AND "payoutId" IS NULL FOR UPDATE`;
    if (!locked.length) return null;
    const items = await tx.deliveryAssignment.findMany({ where: { id: { in: locked.map((l) => l.id) } } });
    const payout = await tx.riderPayout.create({
      data: {
        riderId,
        createdById: adminId,
        deliveryCount: items.length,
        feesKobo: items.reduce((n, i) => n + i.deliveryFeeKobo, 0),
        commissionKobo: items.reduce((n, i) => n + i.riderCommissionKobo, 0),
        amountKobo: items.reduce((n, i) => n + i.riderEarningKobo, 0),
      },
    });
    await tx.deliveryAssignment.updateMany({ where: { id: { in: items.map((i) => i.id) } }, data: { payoutId: payout.id } });
    return payout;
  });
}

export async function markRiderPayoutPaid(payoutId: string, transferReference: string) {
  return db.$transaction(async (tx) => {
    const payout = await tx.riderPayout.update({ where: { id: payoutId, status: "PENDING" }, data: { status: "PAID", paidAt: new Date(), transferReference } });
    await tx.deliveryAssignment.updateMany({ where: { payoutId }, data: { earningStatus: "PAID" } });
    const rider = await tx.rider.findUniqueOrThrow({ where: { id: payout.riderId } });
    await tx.notification.create({ data: { userId: rider.userId, title: "Payout sent", body: `We've paid your earnings for ${payout.deliveryCount} deliveries. Reference: ${transferReference}.` } });
    return payout;
  });
}
