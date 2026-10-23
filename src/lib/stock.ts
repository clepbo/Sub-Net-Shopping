import "server-only";
import { deriveAvailability, listingStatusOf } from "./inventory";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

export class StockError extends Error {}

/** Takes `quantity` from tracked stock; false when stock isn't tracked. Throws if too little is left. */
export async function reserveStock(tx: Tx, inventoryId: string, quantity: number, name: string): Promise<boolean> {
  const listing = await tx.inventory.findUniqueOrThrow({ where: { id: inventoryId }, select: { stockQuantity: true } });
  if (listing.stockQuantity === null) return false;
  // Conditional decrement: two checkouts racing for the last items can't both succeed.
  const updated = await tx.inventory.updateMany({
    where: { id: inventoryId, stockQuantity: { gte: quantity } },
    data: { stockQuantity: { decrement: quantity } },
  });
  if (updated.count === 0) throw new StockError(`Not enough “${name}” left in stock`);
  await refreshAvailability(tx, inventoryId);
  return true;
}

export async function releaseStock(tx: Tx, inventoryId: string | null, quantity: number) {
  if (!inventoryId || quantity <= 0) return;
  const updated = await tx.inventory.updateMany({
    where: { id: inventoryId, stockQuantity: { not: null } },
    data: { stockQuantity: { increment: quantity } },
  });
  if (updated.count) await refreshAvailability(tx, inventoryId);
}

/** Keeps in/low/out-of-stock in step with the quantity, respecting "hidden". */
async function refreshAvailability(tx: Tx, inventoryId: string) {
  const l = await tx.inventory.findUniqueOrThrow({ where: { id: inventoryId }, select: { availability: true, stockQuantity: true } });
  const status = listingStatusOf(l.availability) === "HIDDEN" ? "HIDDEN" : "AVAILABLE";
  await tx.inventory.update({ where: { id: inventoryId }, data: { availability: deriveAvailability(status, l.stockQuantity) } });
}
