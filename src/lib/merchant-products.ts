import "server-only";
import { db } from "./db";
import type { Availability } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export const MERCHANT_PAGE_SIZE = 30;

export async function listStoreInventory(
  supermarketId: string,
  opts: { q?: string; availability?: Availability; categoryId?: string; page?: number },
) {
  const q = opts.q?.trim();
  const where: Prisma.InventoryWhereInput = {
    supermarketId,
    ...(opts.availability ? { availability: opts.availability } : {}),
    ...(opts.categoryId ? { product: { categoryId: opts.categoryId } } : {}),
    ...(q
      ? {
          OR: [
            { sku: { contains: q, mode: "insensitive" } },
            { product: { name: { contains: q, mode: "insensitive" } } },
            { product: { brand: { contains: q, mode: "insensitive" } } },
            { product: { barcode: q } },
          ],
        }
      : {}),
  };
  const page = Math.max(1, opts.page ?? 1);
  const [items, total] = await Promise.all([
    db.inventory.findMany({
      where,
      include: {
        product: {
          include: {
            category: { select: { name: true } },
            images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], take: 1 },
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: MERCHANT_PAGE_SIZE,
      skip: (page - 1) * MERCHANT_PAGE_SIZE,
    }),
    db.inventory.count({ where }),
  ]);
  return { items, total, page };
}

export async function inventoryCounts(supermarketId: string) {
  const rows = await db.inventory.groupBy({ by: ["availability"], where: { supermarketId }, _count: true });
  const by = (a: Availability) => rows.find((r) => r.availability === a)?._count ?? 0;
  return {
    total: rows.reduce((n, r) => n + r._count, 0),
    inStock: by("IN_STOCK"),
    lowStock: by("LOW_STOCK"),
    outOfStock: by("OUT_OF_STOCK"),
    hidden: by("UNAVAILABLE"),
  };
}

/** A listing of this store, with its product and images. Null if it isn't theirs. */
export async function getStoreListing(supermarketId: string, inventoryId: string) {
  return db.inventory.findFirst({
    where: { id: inventoryId, supermarketId },
    include: {
      product: {
        include: {
          category: true,
          images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
          _count: { select: { inventory: true } },
        },
      },
    },
  });
}

/** Catalogue products this store doesn't sell yet, for "sell an existing product". */
export async function searchCatalogForStore(supermarketId: string, q: string) {
  const term = q.trim();
  if (!term) return [];
  return db.product.findMany({
    where: {
      inventory: { none: { supermarketId } },
      OR: [{ name: { contains: term, mode: "insensitive" } }, { brand: { contains: term, mode: "insensitive" } }, { barcode: term }],
    },
    include: {
      category: { select: { name: true } },
      images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], take: 1 },
      _count: { select: { inventory: true } },
    },
    orderBy: { name: "asc" },
    take: 20,
  });
}

export const MAX_PRODUCT_IMAGES = 8;
