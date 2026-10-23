import "server-only";
import { db } from "../db";
import type { PosAdapter, PosItem } from "./types";

// Adapters are registered here as integrations are built for participating
// supermarkets' POS systems. None exist yet; stores without one manage
// inventory manually.
const adapters: Record<string, PosAdapter> = {};

export function posAdapter(provider: string | null): PosAdapter | null {
  return provider ? (adapters[provider] ?? null) : null;
}

function availabilityFor(stock: number | undefined) {
  if (stock === undefined) return "IN_STOCK" as const;
  if (stock <= 0) return "OUT_OF_STOCK" as const;
  if (stock <= 5) return "LOW_STOCK" as const;
  return "IN_STOCK" as const;
}

/**
 * Upserts a batch of POS items into a supermarket's inventory. Products are
 * matched by barcode first so the same item is shared across stores, and a
 * product's images are untouched when price or stock changes.
 */
export async function applyPosItems(supermarketId: string, items: PosItem[]) {
  let updated = 0;
  for (const item of items) {
    await db.$transaction(async (tx) => {
      const existing = await tx.inventory.findUnique({
        where: { supermarketId_sku: { supermarketId, sku: item.sku } },
        select: { productId: true },
      });
      let productId = existing?.productId;
      if (!productId && item.barcode) {
        productId = (await tx.product.findUnique({ where: { barcode: item.barcode }, select: { id: true } }))?.id;
      }
      if (!productId) {
        productId = (await tx.product.create({ data: { name: item.name, barcode: item.barcode } })).id;
      }
      const data = {
        priceKobo: item.priceKobo,
        stockQuantity: item.stockQuantity ?? null,
        availability: availabilityFor(item.stockQuantity),
        source: "POS_SYNC" as const,
        externalRef: item.externalRef ?? null,
        lastSyncedAt: new Date(),
      };
      await tx.inventory.upsert({
        where: { supermarketId_sku: { supermarketId, sku: item.sku } },
        create: { supermarketId, productId, sku: item.sku, ...data },
        update: data,
      });
    });
    updated++;
  }
  return updated;
}

/** Runs a full sync for one supermarket and records the run. */
export async function syncSupermarket(supermarketId: string) {
  const store = await db.supermarket.findUniqueOrThrow({ where: { id: supermarketId } });
  const adapter = posAdapter(store.posProvider);
  if (!adapter) throw new Error("No POS integration is available for this supermarket yet");
  const run = await db.posSyncRun.create({ data: { supermarketId, provider: adapter.id } });
  try {
    const items = await adapter.fetchItems({ supermarketId });
    const itemsUpdated = await applyPosItems(supermarketId, items);
    return db.posSyncRun.update({
      where: { id: run.id },
      data: { status: "SUCCEEDED", itemsSeen: items.length, itemsUpdated, finishedAt: new Date() },
    });
  } catch (err) {
    await db.posSyncRun.update({
      where: { id: run.id },
      data: { status: "FAILED", error: err instanceof Error ? err.message : String(err), finishedAt: new Date() },
    });
    throw err;
  }
}
