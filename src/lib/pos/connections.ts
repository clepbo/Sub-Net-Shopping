import "server-only";
// Live POS connections that work with any POS:
//  • Push: the POS (or a small connector) sends item, price and stock changes
//    to /api/pos/v1/items with the store's API key.
//  • Pull: SubNet re-reads a CSV feed URL (e.g. a POS's scheduled export or a
//    published Google Sheet) every hour.
// Prices from the POS are shelf prices; customers see them marked up.
import { createHash, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { db } from "../db";
import { upsertListing, deriveAvailability, parseNairaToKobo } from "../inventory";
import { planImport } from "../csv-import";
import { listingPrices } from "../pricing";

const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

/** Makes a new API key for a store, replacing any old one. Returned once; only its hash is kept. */
export async function rotatePosKey(supermarketId: string) {
  const key = `snpos_${randomBytes(24).toString("base64url")}`;
  await db.supermarket.update({ where: { id: supermarketId }, data: { posApiKeyHash: hashKey(key), posApiKeyHint: key.slice(-4) } });
  return key;
}

export async function revokePosKey(supermarketId: string) {
  await db.supermarket.update({ where: { id: supermarketId }, data: { posApiKeyHash: null, posApiKeyHint: null } });
}

/** The approved store a bearer key belongs to. */
export async function storeForPosKey(authorization: string | null) {
  const key = authorization?.match(/^Bearer\s+(snpos_[A-Za-z0-9_-]{20,})$/)?.[1];
  if (!key) return null;
  const store = await db.supermarket.findUnique({ where: { posApiKeyHash: hashKey(key) }, select: { id: true, status: true } });
  return store && store.status === "APPROVED" ? store : null;
}

export type PosPushItem = {
  sku: string;
  name?: string;
  /** Shelf price in naira (number or "1,250.50"). */
  price?: number | string;
  stock?: number | null;
  barcode?: string;
  category?: string;
  brand?: string;
  unit?: string;
};

export const MAX_PUSH_ITEMS = 500;

async function categoryResolver() {
  const categories = await db.category.findMany({ select: { id: true, name: true, slug: true } });
  const byName = new Map<string, string>();
  for (const c of categories) {
    byName.set(c.name.toLowerCase(), c.id);
    byName.set(c.slug.toLowerCase(), c.id);
  }
  return (n: string) => byName.get(n.trim().toLowerCase()) ?? null;
}

/**
 * Applies pushed items. A full item (sku, name, price) creates or updates the
 * listing; a partial one (sku plus price and/or stock) updates an existing
 * listing, which is what most POS "stock changed" events look like.
 */
export async function applyPushedItems(supermarketId: string, items: PosPushItem[]) {
  const run = await db.posSyncRun.create({ data: { supermarketId, provider: "api", itemsSeen: items.length } });
  const resolve = await categoryResolver();
  const errors: { sku: string; error: string }[] = [];
  let updated = 0;
  for (const raw of items) {
    const sku = String(raw?.sku ?? "").trim();
    if (!sku || sku.length > 60) {
      errors.push({ sku, error: "sku is required (up to 60 characters)" });
      continue;
    }
    const priceKobo = raw.price === undefined ? undefined : parseNairaToKobo(String(raw.price));
    if (priceKobo === null) {
      errors.push({ sku, error: "price isn't a valid naira amount" });
      continue;
    }
    const stock = raw.stock === undefined ? undefined : raw.stock === null ? null : Number(raw.stock);
    if (stock !== undefined && stock !== null && !Number.isInteger(stock)) {
      errors.push({ sku, error: "stock must be a whole number or null" });
      continue;
    }
    const stockQuantity = stock === undefined || stock === null ? stock : Math.max(0, stock);
    try {
      if (raw.name && priceKobo !== undefined) {
        const categoryId = raw.category ? resolve(raw.category) : null;
        await db.$transaction((tx) =>
          upsertListing(
            tx,
            supermarketId,
            {
              sku,
              name: String(raw.name).slice(0, 160),
              priceKobo,
              stockQuantity: stockQuantity ?? null,
              barcode: raw.barcode?.replace(/\s/g, "") || null,
              categoryId,
              brand: raw.brand?.slice(0, 80) ?? null,
              unit: raw.unit?.slice(0, 40) ?? null,
            },
            "POS_SYNC",
          ),
        );
      } else {
        const listing = await db.inventory.findUnique({ where: { supermarketId_sku: { supermarketId, sku } } });
        if (!listing) {
          errors.push({ sku, error: "unknown sku: send name and price to create it" });
          continue;
        }
        const hidden = listing.availability === "UNAVAILABLE";
        const nextStock = stockQuantity === undefined ? listing.stockQuantity : stockQuantity;
        await db.inventory.update({
          where: { id: listing.id },
          data: {
            ...(priceKobo !== undefined ? await listingPrices(db, listing.productId, priceKobo).then(({ priceKobo: p, shelfPriceKobo }) => ({ priceKobo: p, shelfPriceKobo })) : {}),
            stockQuantity: nextStock,
            availability: deriveAvailability(hidden ? "HIDDEN" : "AVAILABLE", nextStock),
            source: "POS_SYNC",
            lastSyncedAt: new Date(),
          },
        });
      }
      updated++;
    } catch (err) {
      errors.push({ sku, error: err instanceof Error ? err.message : "failed" });
    }
  }
  await db.posSyncRun.update({
    where: { id: run.id },
    data: {
      status: errors.length && !updated ? "FAILED" : "SUCCEEDED",
      itemsUpdated: updated,
      error: errors.length ? `${errors.length} item(s) rejected: ${errors.slice(0, 3).map((e) => `${e.sku}: ${e.error}`).join("; ")}` : null,
      finishedAt: new Date(),
    },
  });
  return { updated, errors };
}

/** Feed URLs must be public https addresses (no local or private hosts). */
export function feedUrlProblem(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "Enter a full link starting with https://";
  }
  if (url.protocol !== "https:") return "The link must start with https://";
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || isIP(host)) return "Use a public web address, not an IP or local host";
  return null;
}

/** Fetches and imports a store's CSV feed. */
export async function syncFeed(supermarketId: string) {
  const store = await db.supermarket.findUniqueOrThrow({ where: { id: supermarketId }, select: { posFeedUrl: true } });
  if (!store.posFeedUrl || feedUrlProblem(store.posFeedUrl)) throw new Error("No valid feed link is set");
  const run = await db.posSyncRun.create({ data: { supermarketId, provider: "feed" } });
  await db.supermarket.update({ where: { id: supermarketId }, data: { posFeedSyncedAt: new Date() } });
  try {
    const res = await fetch(store.posFeedUrl, { signal: AbortSignal.timeout(20_000), redirect: "follow", cache: "no-store" });
    if (!res.ok) throw new Error(`The feed returned HTTP ${res.status}`);
    const text = await res.text();
    if (text.length > 4 * 1024 * 1024) throw new Error("The feed is larger than 4 MB");
    const plan = planImport(text, await categoryResolver());
    if (plan.items.length === 0) throw new Error(plan.errors[0]?.message ?? "The feed has no products");
    let updated = 0;
    for (const item of plan.items) {
      await db.$transaction((tx) => upsertListing(tx, supermarketId, item, "POS_SYNC"));
      updated++;
    }
    return db.posSyncRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCEEDED",
        itemsSeen: plan.items.length,
        itemsUpdated: updated,
        error: plan.errors.length ? `${plan.errors.length} row(s) skipped, e.g. line ${plan.errors[0].line}: ${plan.errors[0].message}` : null,
        finishedAt: new Date(),
      },
    });
  } catch (err) {
    await db.posSyncRun.update({ where: { id: run.id }, data: { status: "FAILED", error: err instanceof Error ? err.message : String(err), finishedAt: new Date() } });
    throw err;
  }
}

/** Re-reads feeds not synced in the last hour (a few per run, from background jobs). */
export async function syncDueFeeds(now = new Date(), limit = 3) {
  const due = await db.supermarket.findMany({
    where: { status: "APPROVED", posFeedUrl: { not: null }, OR: [{ posFeedSyncedAt: null }, { posFeedSyncedAt: { lt: new Date(now.getTime() - 60 * 60_000) } }] },
    orderBy: { posFeedSyncedAt: { sort: "asc", nulls: "first" } },
    select: { id: true },
    take: limit,
  });
  let synced = 0;
  for (const s of due) {
    await syncFeed(s.id).then(() => synced++, (err) => console.error("POS feed sync failed", s.id, err));
  }
  return synced;
}
