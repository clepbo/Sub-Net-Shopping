import "server-only";
import { db } from "./db";
import { requireUser } from "./auth";
import { computeAvailability } from "./availability";
import type { Prisma } from "@/generated/prisma/client";

const withHours = { hours: { orderBy: { dayOfWeek: "asc" } } } satisfies Prisma.SupermarketInclude;

export type SupermarketWithHours = Prisma.SupermarketGetPayload<{ include: typeof withHours }>;

export function availabilityOf(store: SupermarketWithHours, now = new Date()) {
  return computeAvailability(store, now);
}

/**
 * The supermarket the signed-in merchant manages. Access comes from a
 * SupermarketStaff row, never from a client-supplied ID.
 */
export async function requireMerchantStore(opts: { managerOnly?: boolean } = {}) {
  const user = await requireUser("SUPERMARKET");
  const membership = await db.supermarketStaff.findFirst({
    where: { userId: user.id, ...(opts.managerOnly ? { role: "MANAGER" } : {}) },
    orderBy: { createdAt: "asc" },
    include: { supermarket: { include: withHours } },
  });
  if (!membership) throw new Error("No supermarket is linked to this account");
  return { user, store: membership.supermarket, staffRole: membership.role };
}

/** Approved supermarkets visible to customers, optionally filtered by a search term. */
export async function listApprovedSupermarkets(query?: string) {
  const q = query?.trim();
  return db.supermarket.findMany({
    where: {
      status: "APPROVED",
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { area: { contains: q, mode: "insensitive" } },
              { address: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: withHours,
    orderBy: { name: "asc" },
  });
}

export async function getApprovedSupermarket(id: string) {
  return db.supermarket.findFirst({ where: { id, status: "APPROVED" }, include: withHours });
}

export async function getSupermarketForAdmin(id: string) {
  return db.supermarket.findUnique({
    where: { id },
    include: { ...withHours, owner: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true } } },
  });
}
