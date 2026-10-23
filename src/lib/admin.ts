import "server-only";
import { db } from "./db";
import type { ApprovalStatus } from "@/generated/prisma/enums";

export const APPROVAL_STATUSES: ApprovalStatus[] = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"];

export function parseApprovalStatus(value: string | undefined): ApprovalStatus | undefined {
  return APPROVAL_STATUSES.find((s) => s === value);
}

/** Dashboard counts (PRD §21) — always from the live database. */
export async function platformStats() {
  const [customers, supermarketsByStatus, ridersByStatus, activeRiders, suspendedAccounts] = await Promise.all([
    db.user.count({ where: { role: "CUSTOMER" } }),
    db.supermarket.groupBy({ by: ["status"], _count: true }),
    db.rider.groupBy({ by: ["status"], _count: true }),
    db.rider.count({ where: { isOnline: true, status: "APPROVED", user: { status: "ACTIVE" } } }),
    db.user.count({ where: { status: "SUSPENDED" } }),
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
  };
}
