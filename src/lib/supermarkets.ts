import "server-only";
import { db } from "./db";
import { redirect } from "next/navigation";
import { requireUser } from "./auth";
import { computeAvailability } from "./availability";
import type { Prisma } from "@/generated/prisma/client";

const withHours = { hours: { orderBy: { dayOfWeek: "asc" } } } satisfies Prisma.SupermarketInclude;

export type SupermarketWithHours = Prisma.SupermarketGetPayload<{ include: typeof withHours }>;

export function availabilityOf(store: SupermarketWithHours, now = new Date()) {
  return computeAvailability(store, now);
}

/**
 * The supermarket the signed-in merchant works at. Access comes from a
 * SupermarketStaff row, never from a client-supplied ID. With `managerOnly`,
 * other staff are sent back to the dashboard.
 */
export async function requireMerchantStore(opts: { managerOnly?: boolean } = {}) {
  const ctx = await merchantContext();
  if (opts.managerOnly && ctx.staffRole !== "MANAGER") redirect("/merchant?manager=1");
  return ctx;
}

async function merchantContext() {
  const user = await requireUser("SUPERMARKET");
  const membership = await db.supermarketStaff.findFirst({
    where: { userId: user.id },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    include: { supermarket: { include: withHours } },
  });
  if (!membership) redirect("/forbidden");
  return { user, store: membership.supermarket, staffRole: membership.role };
}

/**
 * The merchant's store for an edit. `blocked` carries the message to show
 * instead of saving: suspended or unapproved stores are read-only, and most
 * settings are for managers only (stock and products can be changed by any staff).
 */
export async function requireEditableStore(opts: { managerOnly?: boolean } = {}) {
  const ctx = await merchantContext();
  const managerOnly = opts.managerOnly ?? true;
  const blocked =
    ctx.store.status === "SUSPENDED"
      ? "This supermarket is suspended. Contact SubNet support to make changes."
      : ctx.store.status !== "APPROVED"
        ? "Your supermarket is waiting for approval. You can set it up once it's approved."
        : managerOnly && ctx.staffRole !== "MANAGER"
          ? "Only a store manager can change this. Ask your manager."
          : null;
  return { ...ctx, blocked };
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
