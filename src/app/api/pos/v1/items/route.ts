import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applyPushedItems, MAX_PUSH_ITEMS, storeForPosKey, type PosPushItem } from "@/lib/pos/connections";

export const maxDuration = 120;

/**
 * Live POS push. Authorization: Bearer <store API key from Store profile>.
 * Body: { "items": [{ "sku": "RICE5", "name": "Rice 5kg", "price": 9500, "stock": 12 }] }
 * or just { "sku": "RICE5", "stock": 11 } for a stock change. Prices are shelf prices in naira.
 */
export async function POST(request: Request) {
  const store = await storeForPosKey(request.headers.get("authorization"));
  if (!store) return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send JSON" }, { status: 400 });
  }
  const items = (Array.isArray((body as { items?: unknown }).items) ? (body as { items: PosPushItem[] }).items : [body as PosPushItem]).filter(Boolean);
  if (items.length === 0) return NextResponse.json({ error: "No items" }, { status: 400 });
  if (items.length > MAX_PUSH_ITEMS) return NextResponse.json({ error: `Send up to ${MAX_PUSH_ITEMS} items per request` }, { status: 413 });
  const result = await applyPushedItems(store.id, items);
  return NextResponse.json(result, { status: result.updated === 0 && result.errors.length ? 422 : 200 });
}

/** Lists the store's listings as SubNet has them, so a connector can reconcile. */
export async function GET(request: Request) {
  const store = await storeForPosKey(request.headers.get("authorization"));
  if (!store) return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  const rows = await db.inventory.findMany({
    where: { supermarketId: store.id },
    select: { sku: true, shelfPriceKobo: true, priceKobo: true, stockQuantity: true, availability: true, updatedAt: true, product: { select: { name: true, barcode: true } } },
    orderBy: { sku: "asc" },
    take: 5000,
  });
  return NextResponse.json({
    items: rows.map((r) => ({
      sku: r.sku,
      name: r.product.name,
      barcode: r.product.barcode,
      price: (r.shelfPriceKobo ?? r.priceKobo) / 100,
      customerPrice: r.priceKobo / 100,
      stock: r.stockQuantity,
      availability: r.availability,
      updatedAt: r.updatedAt,
    })),
  });
}
