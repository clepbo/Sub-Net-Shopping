import "server-only";
import { db } from "./db";
import { rankStoresForBasket, type BasketStore } from "./basket-rank";

export const MAX_LIST_ITEMS = 30;

/** Parses the `items` query value: comma-separated product IDs. */
export function parseListParam(value: string | undefined): string[] {
  return [...new Set((value ?? "").split(",").map((s) => s.trim()).filter((s) => /^[a-z0-9_-]{6,40}$/i.test(s)))].slice(0, MAX_LIST_ITEMS);
}

/** Finds the best supermarkets for a shopping list from what's in stock now. */
export async function findStoresForList(productIds: string[], origin: { lat: number; lng: number } | null) {
  const [products, stores] = await Promise.all([
    db.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, unit: true, brand: true, images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } } },
    }),
    db.supermarket.findMany({
      where: { status: "APPROVED", inventory: { some: { productId: { in: productIds }, availability: { in: ["IN_STOCK", "LOW_STOCK"] } } } },
      select: {
        id: true,
        name: true,
        address: true,
        area: true,
        logoUrl: true,
        latitude: true,
        longitude: true,
        inventory: {
          where: { productId: { in: productIds }, availability: { in: ["IN_STOCK", "LOW_STOCK"] } },
          select: { id: true, productId: true, priceKobo: true, availability: true },
        },
      },
    }),
  ]);
  const basketStores: BasketStore[] = stores.map(({ inventory, ...s }) => ({
    ...s,
    offers: inventory.map((i) => ({ productId: i.productId, inventoryId: i.id, priceKobo: i.priceKobo, lowStock: i.availability === "LOW_STOCK" })),
  }));
  // Keep the shopper's order; drop IDs that no longer exist.
  const byId = new Map(products.map((p) => [p.id, p]));
  const list = productIds.map((id) => byId.get(id)).filter((p) => p !== undefined);
  return { list, result: rankStoresForBasket(list.map((p) => p.id), basketStores, origin) };
}
