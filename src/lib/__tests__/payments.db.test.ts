// Integration tests against a real Postgres and the mock Paystack server
// (uses DATABASE_URL; skipped without it).
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startMockPaystack } from "../../../scripts/mock-paystack.mjs";

const enabled = Boolean(process.env.DATABASE_URL);
const PORT = 4321;
process.env.PAYSTACK_SECRET_KEY = "sk_test_vitest";
process.env.PAYSTACK_BASE_URL = `http://localhost:${PORT}`;

describe.skipIf(!enabled)("payments, pickup and settlement (database)", async () => {
  const { db } = await import("../db");
  const { placeOrder, changeOrderStatus, adjustOrderItem } = await import("../orders");
  const { startOnlinePayment, verifyAndApply } = await import("../payments");
  const { expireStalePayments } = await import("../payments/expiry");
  const { findOrderForPickup, completePickup } = await import("../pickup");
  const { createSettlement } = await import("../settlements");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mock: any;
  const tag = `p${Date.now()}`;
  let seq = 0;
  const phone = () => `+23491${String(Date.now() + seq++).slice(-8)}`;
  let storeId = "";
  let otherStoreId = "";
  let ownerId = "";
  let milk = "";
  let bread = "";

  async function customer() {
    return (await db.user.create({ data: { role: "CUSTOMER", firstName: "C", lastName: "T", email: `c${seq++}@${tag}.test`, phone: phone(), passwordHash: "x" } })).id;
  }
  async function onlineOrder(lines: [string, number][]) {
    const c = await customer();
    for (const [inventoryId, quantity] of lines) await db.cartItem.create({ data: { userId: c, inventoryId, quantity } });
    const orderId = await placeOrder({ customerId: c, supermarketId: storeId, checkoutKey: `${tag}-${seq++}`, note: null, paymentMethod: "ONLINE" });
    await startOnlinePayment({ orderId, customerId: c, appUrl: "http://app.test" });
    const payment = await db.payment.findFirstOrThrow({ where: { orderId }, orderBy: { createdAt: "desc" } });
    return { c, orderId, reference: payment.reference };
  }
  const payViaMock = (ref: string) => fetch(`http://localhost:${PORT}/__control/pay/${ref}?webhook=0`, { method: "POST" });
  const stock = async (id: string) => (await db.inventory.findUniqueOrThrow({ where: { id } })).stockQuantity;
  const order = (id: string) => db.order.findUniqueOrThrow({ where: { id }, include: { events: true, payments: { include: { refunds: true } } } });

  beforeAll(async () => {
    mock = await startMockPaystack({ port: PORT, secret: "sk_test_vitest" });
    const owner = await db.user.create({ data: { role: "SUPERMARKET", firstName: "O", lastName: "T", email: `owner@${tag}.test`, phone: phone(), passwordHash: "x" } });
    ownerId = owner.id;
    const mk = async (name: string) =>
      (
        await db.supermarket.create({
          data: {
            ownerId,
            name: `${tag} ${name}`,
            contactName: "O",
            phone: "+2348000000000",
            email: `${name}@${tag}.test`,
            address: "1 Road",
            status: "APPROVED",
            hours: { create: Array.from({ length: 7 }, (_, d) => ({ dayOfWeek: d, isOpen: true, opensAt: "00:00", closesAt: "23:59" })) },
            staff: { create: { userId: ownerId, role: "MANAGER" } },
          },
        })
      ).id;
    storeId = await mk("Mart");
    otherStoreId = await mk("Other");
    const listing = async (name: string, priceKobo: number, stockQuantity: number | null) => {
      const p = await db.product.create({ data: { name: `${tag} ${name}` } });
      return (await db.inventory.create({ data: { supermarketId: storeId, productId: p.id, sku: name, priceKobo, stockQuantity } })).id;
    };
    milk = await listing("Milk", 65_000, 20);
    bread = await listing("Bread", 120_000, null);
  });

  afterAll(async () => {
    await db.order.deleteMany({ where: { supermarketId: { in: [storeId, otherStoreId] } } });
    await db.settlement.deleteMany({ where: { supermarketId: storeId } });
    await db.supermarket.deleteMany({ where: { id: { in: [storeId, otherStoreId] } } });
    await db.product.deleteMany({ where: { name: { startsWith: tag } } });
    await db.user.deleteMany({ where: { email: { endsWith: `@${tag}.test` } } });
    await mock?.close();
  });

  it("holds an online order from the store until payment, then applies it exactly once", async () => {
    const before = await stock(milk);
    const { orderId, reference } = await onlineOrder([[milk, 2]]);
    let o = await order(orderId);
    expect(o).toMatchObject({ status: "AWAITING_PAYMENT", paymentStatus: "UNPAID", commissionPercent: 10, commissionKobo: 13_000 });
    expect(await stock(milk)).toBe(before! - 2);
    expect(await db.notification.count({ where: { userId: ownerId, title: { contains: o.number } } })).toBe(0);

    expect((await verifyAndApply(reference)).outcome).toBe("pending");
    await payViaMock(reference);
    const results = await Promise.all([verifyAndApply(reference), verifyAndApply(reference), verifyAndApply(reference)]);
    expect(results.map((r) => r.outcome).sort()).toEqual(["already-processed", "already-processed", "paid"]);
    o = await order(orderId);
    expect(o).toMatchObject({ status: "PLACED", paymentStatus: "PAID" });
    expect(o.events.filter((e) => e.note?.startsWith("Payment received"))).toHaveLength(1);
    expect(await db.notification.count({ where: { userId: ownerId, title: `New order ${o.number}` } })).toBe(1);
  });

  it("refunds a payment for the wrong amount and leaves the order unpaid", async () => {
    const { orderId, reference } = await onlineOrder([[bread, 1]]);
    await payViaMock(reference);
    mock.transactions.get(reference).amount = 100; // tampered
    expect((await verifyAndApply(reference)).outcome).toBe("refunded");
    const o = await order(orderId);
    expect(o.status).toBe("AWAITING_PAYMENT");
    expect(o.payments[0].refunds[0]).toMatchObject({ amountKobo: 100, status: "PENDING" });
  });

  it("expires unpaid orders after 30 minutes and releases stock", async () => {
    const before = await stock(milk);
    const { orderId } = await onlineOrder([[milk, 3]]);
    await db.order.update({ where: { id: orderId }, data: { placedAt: new Date(Date.now() - 31 * 60_000) } });
    expect(await expireStalePayments()).toBeGreaterThanOrEqual(1);
    const o = await order(orderId);
    expect(o.status).toBe("CANCELLED");
    expect(o.payments[0].status).toBe("FAILED");
    expect(await stock(milk)).toBe(before);
  });

  it("applies a payment the webhook missed instead of expiring the order", async () => {
    const { orderId, reference } = await onlineOrder([[bread, 1]]);
    await payViaMock(reference);
    await db.order.update({ where: { id: orderId }, data: { placedAt: new Date(Date.now() - 31 * 60_000) } });
    await expireStalePayments();
    expect((await order(orderId)).status).toBe("PLACED");
  });

  it("restores an expired order paid late if stock allows, otherwise refunds", async () => {
    const a = await onlineOrder([[milk, 1]]);
    await db.order.update({ where: { id: a.orderId }, data: { placedAt: new Date(Date.now() - 31 * 60_000) } });
    // Expire without consulting Paystack: simulate the payment landing afterwards.
    await changeOrderStatus({ orderId: a.orderId, actor: "SYSTEM", actorId: null, to: "CANCELLED", reason: "Payment wasn't completed within 30 minutes, so the order was cancelled and the items released." });
    await payViaMock(a.reference);
    expect((await verifyAndApply(a.reference)).outcome).toBe("restored");
    expect(await order(a.orderId)).toMatchObject({ status: "PLACED", paymentStatus: "PAID", cancelReason: null });

    const b = await onlineOrder([[milk, 2]]);
    await changeOrderStatus({ orderId: b.orderId, actor: "SYSTEM", actorId: null, to: "CANCELLED", reason: "Payment wasn't completed within 30 minutes, so the order was cancelled and the items released." });
    await db.inventory.update({ where: { id: milk }, data: { stockQuantity: 0 } });
    await payViaMock(b.reference);
    expect((await verifyAndApply(b.reference)).outcome).toBe("refunded");
    expect(await order(b.orderId)).toMatchObject({ status: "CANCELLED", paymentStatus: "REFUNDED" });
    await db.inventory.update({ where: { id: milk }, data: { stockQuantity: 20, availability: "IN_STOCK" } });
  });

  it("refunds the difference when the store reduces a paid order, and everything when it cancels", async () => {
    const { orderId, reference } = await onlineOrder([[milk, 2], [bread, 1]]);
    await payViaMock(reference);
    await verifyAndApply(reference);
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId, sku: "Milk" } });
    await adjustOrderItem({ supermarketId: storeId, orderItemId: item.id, quantity: 1, actorId: ownerId });
    let o = await order(orderId);
    expect(o).toMatchObject({ totalKobo: 185_000, commissionKobo: 18_500 });
    expect(o.payments[0].refunds.map((r) => r.amountKobo)).toEqual([65_000]);
    await changeOrderStatus({ orderId, actor: "STORE", actorId: ownerId, to: "CANCELLED", reason: "Closing early" });
    o = await order(orderId);
    expect(o.payments[0].refunds.map((r) => r.amountKobo).sort((a, b) => a - b)).toEqual([65_000, 185_000]);
    expect(o.paymentStatus).toBe("REFUNDED");
  });

  it("verifies pickup by PIN or QR token, only when ready, and expires the code after collection", async () => {
    const { orderId, reference } = await onlineOrder([[bread, 1]]);
    await payViaMock(reference);
    await verifyAndApply(reference);
    const o = await order(orderId);
    expect(await findOrderForPickup(storeId, { pin: o.pickupPin })).toEqual({ ok: true, orderId });
    expect(await findOrderForPickup(otherStoreId, { token: o.pickupToken })).toMatchObject({ ok: false, reason: expect.stringMatching(/different supermarket/) });
    expect(await findOrderForPickup(storeId, { pin: "12" })).toMatchObject({ ok: false });
    await expect(completePickup({ supermarketId: storeId, actorId: ownerId, orderId, token: o.pickupToken })).rejects.toThrow(/ready for pickup/);
    await changeOrderStatus({ orderId, actor: "STORE", actorId: ownerId, to: "CONFIRMED" });
    await changeOrderStatus({ orderId, actor: "STORE", actorId: ownerId, to: "READY_FOR_PICKUP" });
    await completePickup({ supermarketId: storeId, actorId: ownerId, orderId, token: o.pickupToken });
    expect((await order(orderId)).status).toBe("COLLECTED");
    expect(await findOrderForPickup(storeId, { token: o.pickupToken })).toMatchObject({ ok: false, reason: expect.stringMatching(/already been collected/) });
    expect(await findOrderForPickup(storeId, { pin: o.pickupPin })).toMatchObject({ ok: false });
  });

  it("settles collected orders once, netting online sales against pay-at-store commission", async () => {
    // One pay-at-store order collected (₦1,200 at 10% → store owes ₦120).
    const c = await customer();
    await db.cartItem.create({ data: { userId: c, inventoryId: bread, quantity: 1 } });
    const id = await placeOrder({ customerId: c, supermarketId: storeId, checkoutKey: `${tag}-store`, note: null });
    for (const to of ["CONFIRMED", "READY_FOR_PICKUP"] as const) await changeOrderStatus({ orderId: id, actor: "STORE", actorId: ownerId, to });
    const pin = (await order(id)).pickupPin;
    await completePickup({ supermarketId: storeId, actorId: ownerId, orderId: id, pin });
    expect(await order(id)).toMatchObject({ paymentStatus: "PAID" });

    const s = await createSettlement(storeId, ownerId);
    // Online: ₦1,200 collected above (net ₦1,080); pay-at-store: owes ₦120.
    expect(s).toMatchObject({ orderCount: 2, grossKobo: 240_000, commissionKobo: 24_000, onlineNetKobo: 108_000, storeOwesKobo: 12_000, payableKobo: 96_000 });
    expect(await createSettlement(storeId, ownerId)).toBeNull();
  });
});
