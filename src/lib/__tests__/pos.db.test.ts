// Integration tests for the live POS connection (uses DATABASE_URL; skipped without it).
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = Boolean(process.env.DATABASE_URL);

describe.skipIf(!enabled)("live POS connection (database)", async () => {
  const { db } = await import("../db");
  const pos = await import("../pos/connections");
  const tag = `p${Date.now()}`;
  let storeId = "";
  let key = "";

  beforeAll(async () => {
    const owner = await db.user.create({ data: { role: "SUPERMARKET", firstName: "O", lastName: "T", email: `o@${tag}.test`, phone: `+23483${String(Date.now()).slice(-8)}`, passwordHash: "x" } });
    storeId = (await db.supermarket.create({ data: { ownerId: owner.id, name: `${tag} Mart`, contactName: "O", phone: "+2348000000000", email: `s@${tag}.test`, address: "1 Road", status: "APPROVED" } })).id;
    key = await pos.rotatePosKey(storeId);
  });
  afterAll(async () => {
    await db.supermarket.deleteMany({ where: { id: storeId } });
    await db.product.deleteMany({ where: { name: { startsWith: tag } } });
    await db.user.deleteMany({ where: { email: { endsWith: `@${tag}.test` } } });
  });

  it("only accepts the store's current key", async () => {
    expect((await pos.storeForPosKey(`Bearer ${key}`))?.id).toBe(storeId);
    expect(await pos.storeForPosKey("Bearer snpos_wrongwrongwrongwrongwrong")).toBeNull();
    expect(await pos.storeForPosKey(null)).toBeNull();
    const old = key;
    key = await pos.rotatePosKey(storeId);
    expect(await pos.storeForPosKey(`Bearer ${old}`)).toBeNull();
    expect((await db.supermarket.findUniqueOrThrow({ where: { id: storeId } })).posApiKeyHint).toBe(key.slice(-4));
  });

  it("creates listings from full items and applies quick stock and price changes", async () => {
    let r = await pos.applyPushedItems(storeId, [{ sku: "R5", name: `${tag} Rice`, price: 10000, stock: 12 }]);
    expect(r).toEqual({ updated: 1, errors: [] });
    let inv = await db.inventory.findUniqueOrThrow({ where: { supermarketId_sku: { supermarketId: storeId, sku: "R5" } } });
    expect(inv).toMatchObject({ shelfPriceKobo: 1_000_000, stockQuantity: 12, source: "POS_SYNC", availability: "IN_STOCK" });
    expect(inv.priceKobo).toBeGreaterThan(1_000_000);

    r = await pos.applyPushedItems(storeId, [{ sku: "R5", stock: 0 }, { sku: "NOPE", stock: 3 }, { sku: "R5", price: "abc" }]);
    expect(r.updated).toBe(1);
    expect(r.errors.map((e) => e.sku)).toEqual(["NOPE", "R5"]);
    inv = await db.inventory.findUniqueOrThrow({ where: { id: inv.id } });
    expect(inv).toMatchObject({ stockQuantity: 0, availability: "OUT_OF_STOCK", shelfPriceKobo: 1_000_000 });

    await pos.applyPushedItems(storeId, [{ sku: "R5", price: "9,500" }]);
    inv = await db.inventory.findUniqueOrThrow({ where: { id: inv.id } });
    expect(inv.shelfPriceKobo).toBe(950_000);
    const runs = await db.posSyncRun.findMany({ where: { supermarketId: storeId, provider: "api" } });
    expect(runs).toHaveLength(3);
  });

  it("only allows public https feed links", () => {
    expect(pos.feedUrlProblem("https://docs.google.com/spreadsheets/d/x/export?format=csv")).toBeNull();
    expect(pos.feedUrlProblem("http://example.com/a.csv")).toMatch(/https/);
    expect(pos.feedUrlProblem("https://127.0.0.1/a.csv")).toMatch(/public/);
    expect(pos.feedUrlProblem("https://localhost/a.csv")).toMatch(/public/);
    expect(pos.feedUrlProblem("not a url")).toMatch(/full link/);
  });
});
