import "server-only";
import { db } from "../db";
import { upsertListing } from "../inventory";
import type { PosAdapter } from "./types";

// Adapters are registered here as integrations are built for participating
// supermarkets' POS systems. Until then stores import a CSV export from
// their POS (see lib/csv-import.ts) or manage products manually.
const adapters: Record<string, PosAdapter> = {};

export function posAdapter(provider: string | null): PosAdapter | null {
  return provider ? (adapters[provider] ?? null) : null;
}

/** Runs a full sync for one supermarket and records the run. */
export async function syncSupermarket(supermarketId: string) {
  const store = await db.supermarket.findUniqueOrThrow({ where: { id: supermarketId } });
  const adapter = posAdapter(store.posProvider);
  if (!adapter) throw new Error("No POS integration is available for this supermarket yet");
  const run = await db.posSyncRun.create({ data: { supermarketId, provider: adapter.id } });
  try {
    const items = await adapter.fetchItems({ supermarketId });
    let itemsUpdated = 0;
    for (const item of items) {
      await db.$transaction((tx) =>
        upsertListing(
          tx,
          supermarketId,
          { ...item, stockQuantity: item.stockQuantity ?? null },
          "POS_SYNC",
        ),
      );
      itemsUpdated++;
    }
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
