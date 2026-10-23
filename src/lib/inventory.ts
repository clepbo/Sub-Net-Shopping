// Availability rules and listing upserts shared by manual edits, CSV
// import and POS sync, so every source produces the same records.
import type { Availability, InventorySource } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export const LOW_STOCK_THRESHOLD = 5;

/** What the merchant chose for a listing; stock refines "AVAILABLE". */
export type ListingStatus = "AVAILABLE" | "OUT_OF_STOCK" | "HIDDEN";

export function deriveAvailability(status: ListingStatus, stockQuantity: number | null): Availability {
  if (status === "HIDDEN") return "UNAVAILABLE";
  if (status === "OUT_OF_STOCK") return "OUT_OF_STOCK";
  if (stockQuantity === null) return "IN_STOCK";
  if (stockQuantity <= 0) return "OUT_OF_STOCK";
  if (stockQuantity <= LOW_STOCK_THRESHOLD) return "LOW_STOCK";
  return "IN_STOCK";
}

export function listingStatusOf(availability: Availability): ListingStatus {
  if (availability === "UNAVAILABLE") return "HIDDEN";
  if (availability === "OUT_OF_STOCK") return "OUT_OF_STOCK";
  return "AVAILABLE";
}

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  IN_STOCK: "In stock",
  LOW_STOCK: "Low stock",
  OUT_OF_STOCK: "Out of stock",
  UNAVAILABLE: "Hidden",
};

/** Customer-visible: listed and not hidden. */
export const VISIBLE_AVAILABILITY: Availability[] = ["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"];

export type ImportItem = {
  sku: string;
  name: string;
  priceKobo: number;
  stockQuantity: number | null;
  barcode?: string | null;
  categoryId?: string | null;
  brand?: string | null;
  unit?: string | null;
  description?: string | null;
  externalRef?: string | null;
};

/**
 * Creates or updates one of a store's listings from an external source.
 * The listing is found by SKU; a new listing attaches to an existing
 * catalogue product with the same barcode (so prices can be compared
 * across stores) or creates a new product owned by this store. Shared
 * product details are only filled in, never overwritten, unless this
 * store created the product.
 */
export async function upsertListing(
  tx: Prisma.TransactionClient,
  supermarketId: string,
  item: ImportItem,
  source: InventorySource,
): Promise<"created" | "updated"> {
  const existing = await tx.inventory.findUnique({
    where: { supermarketId_sku: { supermarketId, sku: item.sku } },
    select: { id: true, productId: true, availability: true },
  });

  let productId = existing?.productId;
  if (!productId && item.barcode) {
    productId = (await tx.product.findUnique({ where: { barcode: item.barcode }, select: { id: true } }))?.id;
    // Already selling that product under another SKU: update that listing.
    if (productId) {
      const other = await tx.inventory.findUnique({
        where: { supermarketId_productId: { supermarketId, productId } },
        select: { id: true },
      });
      if (other) await tx.inventory.update({ where: { id: other.id }, data: { sku: item.sku } });
    }
  }

  const details = {
    brand: item.brand ?? undefined,
    unit: item.unit ?? undefined,
    description: item.description ?? undefined,
    categoryId: item.categoryId ?? undefined,
  };
  if (productId) {
    const product = await tx.product.findUniqueOrThrow({ where: { id: productId } });
    if (product.createdBySupermarketId === supermarketId) {
      await tx.product.update({ where: { id: productId }, data: { name: item.name, ...details } });
    } else {
      // Only fill gaps in someone else's catalogue entry.
      await tx.product.update({
        where: { id: productId },
        data: {
          brand: product.brand ?? details.brand,
          unit: product.unit ?? details.unit,
          description: product.description ?? details.description,
          categoryId: product.categoryId ?? details.categoryId,
        },
      });
    }
  } else {
    productId = (
      await tx.product.create({
        data: { name: item.name, barcode: item.barcode || null, ...details, createdBySupermarketId: supermarketId },
      })
    ).id;
  }

  // Keep a merchant's "hidden" choice; otherwise derive from stock.
  const status: ListingStatus = existing?.availability === "UNAVAILABLE" ? "HIDDEN" : "AVAILABLE";
  const data = {
    priceKobo: item.priceKobo,
    stockQuantity: item.stockQuantity,
    availability: deriveAvailability(status, item.stockQuantity),
    source,
    externalRef: item.externalRef ?? null,
    lastSyncedAt: new Date(),
  };
  await tx.inventory.upsert({
    where: { supermarketId_productId: { supermarketId, productId } },
    create: { supermarketId, productId, sku: item.sku, ...data },
    update: { sku: item.sku, ...data },
  });
  return existing ? "updated" : "created";
}

/** "1,250.50" or "₦1250" → 125050 kobo. Returns null if not a valid amount. */
export function parseNairaToKobo(input: string): number | null {
  const cleaned = input.replace(/[₦,\s]/g, "").replace(/^NGN/i, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const kobo = Math.round(Number(cleaned) * 100);
  return kobo > 0 && kobo <= 100_000_000_00 ? kobo : null;
}

/** 125050 → "1250.50" for form inputs. */
export function koboToNairaInput(kobo: number): string {
  return kobo % 100 === 0 ? String(kobo / 100) : (kobo / 100).toFixed(2);
}
