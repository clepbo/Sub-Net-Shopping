// Integration test for guest carts moving into an account (uses DATABASE_URL; skipped without it).
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }), headers: async () => new Headers() }));

const enabled = Boolean(process.env.DATABASE_URL);

describe.skipIf(!enabled)("guest carts (database)", async () => {
  const { db } = await import("../db");
  const { moveGuestCart, pruneGuestCarts } = await import("../cart-owner");
  const tag = `g${Date.now()}`;
  let userId = "";
  const inv: string[] = [];

  beforeAll(async () => {
    const owner = await db.user.create({ data: { role: "SUPERMARKET", firstName: "O", lastName: "T", email: `o@${tag}.test`, phone: `+23484${String(Date.now()).slice(-8)}`, passwordHash: "x" } });
    const store = await db.supermarket.create({ data: { ownerId: owner.id, name: `${tag} Mart`, contactName: "O", phone: "+2348000000000", email: `s@${tag}.test`, address: "1 Road", status: "APPROVED" } });
    for (const n of ["a", "b", "c"]) {
      const p = await db.product.create({ data: { name: `${tag} ${n}` } });
      inv.push((await db.inventory.create({ data: { supermarketId: store.id, productId: p.id, sku: n, priceKobo: 1000 } })).id);
    }
    userId = (await db.user.create({ data: { role: "CUSTOMER", firstName: "C", lastName: "T", email: `c@${tag}.test`, phone: `+23485${String(Date.now()).slice(-8)}`, passwordHash: "x" } })).id;
  });
  afterAll(async () => {
    await db.cartItem.deleteMany({ where: { OR: [{ guestId: { startsWith: tag } }, { userId }] } });
    await db.supermarket.deleteMany({ where: { name: `${tag} Mart` } });
    await db.product.deleteMany({ where: { name: { startsWith: tag } } });
    await db.user.deleteMany({ where: { email: { endsWith: `@${tag}.test` } } });
  });

  it("moves a guest's cart into the account, adding up items already there", async () => {
    const guestId = `${tag}-guest-0000000000000000000000000`;
    await db.cartItem.createMany({ data: [{ guestId, inventoryId: inv[0], quantity: 2 }, { guestId, inventoryId: inv[1], quantity: 1 }] });
    await db.cartItem.create({ data: { userId, inventoryId: inv[1], quantity: 3 } });
    expect(await moveGuestCart(guestId, userId)).toBe(2);
    const mine = await db.cartItem.findMany({ where: { userId }, orderBy: { inventoryId: "asc" } });
    expect(Object.fromEntries(mine.map((m) => [m.inventoryId, m.quantity]))).toEqual({ [inv[0]]: 2, [inv[1]]: 4 });
    expect(await db.cartItem.count({ where: { guestId } })).toBe(0);
    // Nothing left to move the second time.
    expect(await moveGuestCart(guestId, userId)).toBe(0);
  });

  it("refuses a cart line with no owner, and forgets stale guest carts", async () => {
    await expect(db.$executeRaw`INSERT INTO "CartItem" ("id","inventoryId","quantity","updatedAt") VALUES (${`${tag}x`}, ${inv[2]}, 1, NOW())`).rejects.toThrow();
    const guestId = `${tag}-stale-000000000000000000000000`;
    await db.cartItem.create({ data: { guestId, inventoryId: inv[2], quantity: 1 } });
    await pruneGuestCarts(new Date(Date.now() + 31 * 24 * 3600_000));
    expect(await db.cartItem.count({ where: { guestId } })).toBe(0);
  });
});
