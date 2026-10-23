// Integration tests against a real Postgres (uses DATABASE_URL; skipped without it).
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = Boolean(process.env.DATABASE_URL);

describe.skipIf(!enabled)("catalogue (database)", async () => {
  const { db } = await import("../db");
  const { browseProducts, getProductWithOffers } = await import("../catalog");
  const { upsertListing } = await import("../inventory");

  const tag = `t${Date.now()}`;
  const ids = { owner: "", a: "", b: "", pending: "" };

  async function makeStore(name: string, status: "APPROVED" | "PENDING") {
    const store = await db.supermarket.create({
      data: { ownerId: ids.owner, name: `${tag} ${name}`, contactName: "Test", phone: "+2348000000000", email: `${name}@${tag}.test`, address: "1 Test Road", status },
    });
    return store.id;
  }

  beforeAll(async () => {
    const owner = await db.user.create({
      data: { role: "SUPERMARKET", firstName: "T", lastName: "T", email: `owner@${tag}.test`, phone: `+23480${String(Date.now()).slice(-8)}`, passwordHash: "x" },
    });
    ids.owner = owner.id;
    ids.a = await makeStore("alpha", "APPROVED");
    ids.b = await makeStore("bravo", "APPROVED");
    ids.pending = await makeStore("pending", "PENDING");
    const item = (sku: string, name: string, priceKobo: number, stockQuantity: number | null, barcode?: string) => ({
      sku,
      name: `${tag} ${name}`,
      priceKobo,
      stockQuantity,
      barcode: barcode ? `${barcode}${String(Date.now()).slice(-6)}` : null,
      categoryId: "cat_groceries",
    });
    const rice = item("R1", "Royal Stallion Rice 5kg", 0, null, "11");
    await db.$transaction(async (tx) => {
      await upsertListing(tx, ids.a, { ...rice, priceKobo: 900_000, stockQuantity: 20 }, "MANUAL");
      // Same barcode at another store attaches to the same product.
      await upsertListing(tx, ids.b, { ...rice, sku: "B-RICE", priceKobo: 850_000, stockQuantity: 0 }, "CSV_IMPORT");
      await upsertListing(tx, ids.pending, { ...rice, sku: "P-RICE", priceKobo: 100, stockQuantity: 5 }, "MANUAL");
      await upsertListing(tx, ids.a, item("M1", "Peak Milk Tin", 60_000, 3), "MANUAL");
      await upsertListing(tx, ids.b, item("S1", "Golden Penny Spaghetti", 120_000, null), "MANUAL");
    });
  });

  afterAll(async () => {
    await db.product.deleteMany({ where: { name: { startsWith: tag } } });
    await db.supermarket.deleteMany({ where: { name: { startsWith: tag } } });
    await db.user.deleteMany({ where: { email: { endsWith: `@${tag}.test` } } });
  });

  it("groups a product across stores and ignores unapproved stores", async () => {
    const { items, total } = await browseProducts({ q: `${tag} rice` });
    expect(total).toBe(1);
    expect(items[0]).toMatchObject({ minPriceKobo: 850_000, maxPriceKobo: 900_000, offers: 2, inStockOffers: 1 });
  });

  it("searches every word across name and brand", async () => {
    expect((await browseProducts({ q: `${tag} milk peak` })).total).toBe(1);
    expect((await browseProducts({ q: `${tag} milk rice` })).total).toBe(0);
    expect((await browseProducts({ q: `${tag} 100%_` })).total).toBe(0);
  });

  it("sorts by price and filters by store and stock", async () => {
    const asc = await browseProducts({ q: tag, sort: "price_asc" });
    expect(asc.items.map((p) => p.minPriceKobo)).toEqual([60_000, 120_000, 850_000]);
    const desc = await browseProducts({ q: tag, sort: "price_desc" });
    expect(desc.items[0].minPriceKobo).toBe(850_000);
    expect((await browseProducts({ q: tag, sort: "relevance" })).total).toBe(3);
    expect((await browseProducts({ q: tag, supermarketId: ids.b })).total).toBe(2);
    const inStock = await browseProducts({ q: tag, supermarketId: ids.b, inStockOnly: true });
    expect(inStock.items.map((p) => p.name)).toEqual([`${tag} Golden Penny Spaghetti`]);
  });

  it("paginates", async () => {
    const page2 = await browseProducts({ q: tag, sort: "price_asc", pageSize: 2, page: 2 });
    expect(page2.total).toBe(3);
    expect(page2.items).toHaveLength(1);
  });

  it("lists offers cheapest first, approved stores only", async () => {
    const { items } = await browseProducts({ q: `${tag} rice` });
    const product = await getProductWithOffers(items[0].id);
    expect(product!.inventory.map((o) => o.priceKobo)).toEqual([850_000, 900_000]);
  });

  it("updates an existing listing by SKU and derives stock status", async () => {
    await db.$transaction((tx) =>
      upsertListing(tx, ids.a, { sku: "M1", name: `${tag} Peak Milk Tin`, priceKobo: 65_000, stockQuantity: 0 }, "CSV_IMPORT"),
    );
    const listing = await db.inventory.findUniqueOrThrow({ where: { supermarketId_sku: { supermarketId: ids.a, sku: "M1" } } });
    expect(listing).toMatchObject({ priceKobo: 65_000, availability: "OUT_OF_STOCK", source: "CSV_IMPORT" });
  });
});
