// Integration tests against a real Postgres (uses DATABASE_URL; skipped without it).
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = Boolean(process.env.DATABASE_URL);

describe.skipIf(!enabled)("orders (database)", async () => {
  const { db } = await import("../db");
  const { placeOrder, changeOrderStatus, adjustOrderItem, OrderError } = await import("../orders");

  const tag = `o${Date.now()}`;
  let seq = 0;
  const phone = () => `+23490${String(Date.now() + seq++).slice(-8)}`;
  let storeId = "";
  let ownerId = "";
  let milk = "";
  let bread = "";
  let rice = "";

  async function customer() {
    const u = await db.user.create({ data: { role: "CUSTOMER", firstName: "C", lastName: "T", email: `c${seq}@${tag}.test`, phone: phone(), passwordHash: "x" } });
    return u.id;
  }
  async function addToCart(userId: string, inventoryId: string, quantity: number) {
    await db.cartItem.create({ data: { userId, inventoryId, quantity } });
  }
  const stock = async (id: string) => db.inventory.findUniqueOrThrow({ where: { id }, select: { stockQuantity: true, availability: true } });

  beforeAll(async () => {
    const owner = await db.user.create({ data: { role: "SUPERMARKET", firstName: "O", lastName: "T", email: `owner@${tag}.test`, phone: phone(), passwordHash: "x" } });
    ownerId = owner.id;
    const store = await db.supermarket.create({
      data: {
        ownerId,
        name: `${tag} Mart`,
        contactName: "O",
        phone: "+2348000000000",
        email: `s@${tag}.test`,
        address: "1 Road",
        status: "APPROVED",
        pickupEnabled: true,
        hours: { create: Array.from({ length: 7 }, (_, d) => ({ dayOfWeek: d, isOpen: true, opensAt: "00:00", closesAt: "23:59" })) },
        staff: { create: { userId: ownerId, role: "MANAGER" } },
      },
    });
    storeId = store.id;
    const listing = async (name: string, priceKobo: number, stockQuantity: number | null) => {
      const p = await db.product.create({ data: { name: `${tag} ${name}` } });
      return (await db.inventory.create({ data: { supermarketId: storeId, productId: p.id, sku: name, priceKobo, stockQuantity } })).id;
    };
    milk = await listing("Milk", 65_000, 10);
    bread = await listing("Bread", 120_000, null); // stock not tracked
    rice = await listing("Rice", 1_250_000, 1);
  });

  afterAll(async () => {
    await db.order.deleteMany({ where: { supermarketId: storeId } });
    await db.supermarket.deleteMany({ where: { id: storeId } });
    await db.product.deleteMany({ where: { name: { startsWith: tag } } });
    await db.user.deleteMany({ where: { email: { endsWith: `@${tag}.test` } } });
  });

  it("creates an order from the cart, reserving tracked stock and clearing the cart", async () => {
    const c = await customer();
    await addToCart(c, milk, 3);
    await addToCart(c, bread, 2);
    const id = await placeOrder({ customerId: c, supermarketId: storeId, checkoutKey: `${tag}-a`, note: "Pls bag separately" });
    const order = await db.order.findUniqueOrThrow({ where: { id }, include: { items: true, events: true } });
    expect(order).toMatchObject({ status: "PLACED", subtotalKobo: 435_000, totalKobo: 435_000, paymentMethod: "PAY_AT_STORE", paymentStatus: "UNPAID" });
    expect(order.items.find((i) => i.sku === "Milk")?.stockReserved).toBe(true);
    expect(order.items.find((i) => i.sku === "Bread")?.stockReserved).toBe(false);
    expect(order.events.map((e) => e.status)).toEqual(["PLACED"]);
    expect((await stock(milk)).stockQuantity).toBe(7);
    expect(await db.cartItem.count({ where: { userId: c } })).toBe(0);
    expect(await db.notification.count({ where: { userId: ownerId, title: { contains: order.number } } })).toBe(1);
  });

  it("returns the same order when checkout is submitted twice", async () => {
    const c = await customer();
    await addToCart(c, milk, 1);
    const [a, b] = await Promise.all([
      placeOrder({ customerId: c, supermarketId: storeId, checkoutKey: `${tag}-dup`, note: null }),
      placeOrder({ customerId: c, supermarketId: storeId, checkoutKey: `${tag}-dup`, note: null }).catch((e) => e),
    ]);
    const ids = [a, b].filter((x) => typeof x === "string");
    expect(new Set(ids).size).toBe(1);
    expect(await db.order.count({ where: { checkoutKey: `${tag}-dup` } })).toBe(1);
  });

  it("lets only one of two shoppers have the last item", async () => {
    const [c1, c2] = [await customer(), await customer()];
    await addToCart(c1, rice, 1);
    await addToCart(c2, rice, 1);
    const results = await Promise.allSettled([
      placeOrder({ customerId: c1, supermarketId: storeId, checkoutKey: `${tag}-r1`, note: null }),
      placeOrder({ customerId: c2, supermarketId: storeId, checkoutKey: `${tag}-r2`, note: null }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(failed.reason).toBeInstanceOf(OrderError);
    expect(await stock(rice)).toEqual({ stockQuantity: 0, availability: "OUT_OF_STOCK" });
  });

  it("runs the pickup lifecycle and marks pay-at-store orders paid on collection", async () => {
    const c = await customer();
    await addToCart(c, bread, 1);
    const id = await placeOrder({ customerId: c, supermarketId: storeId, checkoutKey: `${tag}-life`, note: null });
    await expect(changeOrderStatus({ orderId: id, actor: "STORE", actorId: ownerId, to: "COLLECTED" })).rejects.toThrow(OrderError);
    for (const to of ["CONFIRMED", "READY_FOR_PICKUP", "COLLECTED"] as const) await changeOrderStatus({ orderId: id, actor: "STORE", actorId: ownerId, to });
    const order = await db.order.findUniqueOrThrow({ where: { id } });
    expect(order).toMatchObject({ status: "COLLECTED", paymentStatus: "PAID" });
    expect(order.collectedAt).not.toBeNull();
    await expect(changeOrderStatus({ orderId: id, actor: "CUSTOMER", actorId: c, to: "CANCELLED" })).rejects.toThrow(OrderError);
  });

  it("returns reserved stock when an order is cancelled", async () => {
    const before = (await stock(milk)).stockQuantity!;
    const c = await customer();
    await addToCart(c, milk, 2);
    const id = await placeOrder({ customerId: c, supermarketId: storeId, checkoutKey: `${tag}-cancel`, note: null });
    expect((await stock(milk)).stockQuantity).toBe(before - 2);
    await expect(changeOrderStatus({ orderId: id, actor: "STORE", actorId: ownerId, to: "CANCELLED" })).rejects.toThrow(/reason/);
    await changeOrderStatus({ orderId: id, actor: "CUSTOMER", actorId: c, to: "CANCELLED" });
    expect((await stock(milk)).stockQuantity).toBe(before);
  });

  it("lets the store reduce an item before confirming, recalculating totals", async () => {
    const before = (await stock(milk)).stockQuantity!;
    const c = await customer();
    await addToCart(c, milk, 3);
    await addToCart(c, bread, 1);
    const id = await placeOrder({ customerId: c, supermarketId: storeId, checkoutKey: `${tag}-adj`, note: null });
    const milkItem = (await db.orderItem.findFirstOrThrow({ where: { orderId: id, sku: "Milk" } })).id;
    await expect(adjustOrderItem({ supermarketId: storeId, orderItemId: milkItem, quantity: 4, actorId: ownerId })).rejects.toThrow(/between 0 and 3/);
    await adjustOrderItem({ supermarketId: storeId, orderItemId: milkItem, quantity: 1, actorId: ownerId });
    expect(await db.order.findUniqueOrThrow({ where: { id } })).toMatchObject({ subtotalKobo: 185_000, totalKobo: 185_000 });
    expect((await stock(milk)).stockQuantity).toBe(before - 1);
    await expect(adjustOrderItem({ supermarketId: "someone-else", orderItemId: milkItem, quantity: 0, actorId: ownerId })).rejects.toThrow(/not found/);
    await changeOrderStatus({ orderId: id, actor: "STORE", actorId: ownerId, to: "CONFIRMED" });
    await expect(adjustOrderItem({ supermarketId: storeId, orderItemId: milkItem, quantity: 0, actorId: ownerId })).rejects.toThrow(/before the order is confirmed/);
  });

  it("refuses checkout when pickup is paused", async () => {
    const c = await customer();
    await addToCart(c, bread, 1);
    await db.supermarket.update({ where: { id: storeId }, data: { pickupPausedUntil: new Date(Date.now() + 3_600_000) } });
    await expect(placeOrder({ customerId: c, supermarketId: storeId, checkoutKey: `${tag}-paused`, note: null })).rejects.toThrow(/paused/);
    await db.supermarket.update({ where: { id: storeId }, data: { pickupPausedUntil: null } });
    expect(await db.cartItem.count({ where: { userId: c } })).toBe(1);
  });
});
