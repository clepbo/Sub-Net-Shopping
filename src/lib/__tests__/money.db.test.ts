// Integration tests for Monnify payments, markup pricing, cash on delivery
// with the rider wallet, and the nightly payout, against a real Postgres and
// the mock Monnify server (uses DATABASE_URL; skipped without it).
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startMockMonnify } from "../../../scripts/mock-monnify.mjs";

const enabled = Boolean(process.env.DATABASE_URL);
const PORT = 4323;
process.env.MONNIFY_BASE_URL = `http://localhost:${PORT}`;
process.env.MONNIFY_API_KEY = "MK_TEST";
process.env.MONNIFY_SECRET_KEY = "mock-secret";
process.env.MONNIFY_CONTRACT_CODE = "1234567890";
process.env.MONNIFY_WALLET_ACCOUNT_NUMBER = "9999999999";
delete process.env.PAYSTACK_SECRET_KEY;

describe.skipIf(!enabled)("money flows (database)", async () => {
  const { db } = await import("../db");
  const { placeOrder, changeOrderStatus } = await import("../orders");
  const { startOnlinePayment, verifyAndApply } = await import("../payments");
  const { activeProvider } = await import("../payments/gateway");
  const { listingPrices } = await import("../pricing");
  const deliveries = await import("../deliveries");
  const wallet = await import("../rider-wallet");
  const { handleMonnifyEvent } = await import("../payments/monnify-events");
  const { maybeRunDailySettlement, runDailySettlement } = await import("../payouts");
  const { saveSettings, getSettings } = await import("../settings");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mock: any;
  const tag = `m${Date.now()}`;
  let seq = 0;
  const phone = () => `+23482${String(Date.now() + seq++).slice(-8)}`;
  let ownerId = "";
  let storeId = "";
  let rice = "";
  let riderId = "";
  let original: Record<string, string> = {};

  const rider = () => db.rider.findUniqueOrThrow({ where: { id: riderId } });
  async function customer() {
    const u = await db.user.create({ data: { role: "CUSTOMER", firstName: "C", lastName: "T", email: `c${seq++}@${tag}.test`, phone: phone(), passwordHash: "x" } });
    const addr = await db.customerAddress.create({ data: { userId: u.id, label: "Home", address: "5 Ugbowo Road", phone: "+2348030000000", latitude: 6.335, longitude: 5.627 } });
    return { userId: u.id, addressId: addr.id };
  }
  async function cart(userId: string, qty: number) {
    await db.cartItem.create({ data: { userId, inventoryId: rice, quantity: qty } });
  }

  beforeAll(async () => {
    mock = await startMockMonnify({ port: PORT, secret: "mock-secret" });
    original = await getSettings();
    await saveSettings({ riderMaxCashDebt: "20000", cashOnDeliveryEnabled: "1", cashOnDeliveryMaxOrder: "50000", defaultMarkupPercent: "14" }, "test");
    await db.platformSetting.deleteMany({ where: { key: "dailySettlementDay" } });
    const owner = await db.user.create({ data: { role: "SUPERMARKET", firstName: "O", lastName: "T", email: `owner@${tag}.test`, phone: phone(), passwordHash: "x" } });
    ownerId = owner.id;
    storeId = (
      await db.supermarket.create({
        data: {
          ownerId,
          name: `${tag} Mart`,
          contactName: "O",
          phone: "+2348000000000",
          email: `s@${tag}.test`,
          address: "1 Road",
          status: "APPROVED",
          onboardedAt: new Date(),
          latitude: 6.3176,
          longitude: 5.6145,
          deliveryEnabled: true,
          bankCode: "058",
          bankName: "GTBank",
          bankAccountNumber: "0123456789",
          bankAccountName: "MART LTD",
          hours: { create: Array.from({ length: 7 }, (_, d) => ({ dayOfWeek: d, isOpen: true, opensAt: "00:00", closesAt: "23:59" })) },
          staff: { create: { userId: ownerId, role: "MANAGER" } },
        },
      })
    ).id;
    // Shelf ₦10,000 in an uncategorised product → 14% default markup.
    const product = await db.product.create({ data: { name: `${tag} Rice 5kg` } });
    const prices = await listingPrices(db, product.id, 1_000_000);
    rice = (await db.inventory.create({ data: { supermarketId: storeId, productId: product.id, sku: "RICE", ...{ priceKobo: prices.priceKobo, shelfPriceKobo: prices.shelfPriceKobo }, stockQuantity: 100 } })).id;
    const ru = await db.user.create({ data: { role: "RIDER", firstName: "Ade", lastName: "R", email: `rider@${tag}.test`, phone: phone(), passwordHash: "x" } });
    riderId = (await db.rider.create({ data: { userId: ru.id, vehicleType: "MOTORCYCLE", plateNumber: "BEN1", status: "APPROVED", isOnline: true } })).id;
  });

  afterAll(async () => {
    await saveSettings(original, "test");
    await db.platformSetting.deleteMany({ where: { key: "dailySettlementDay" } });
    await db.order.deleteMany({ where: { supermarketId: storeId } });
    await db.settlement.deleteMany({ where: { supermarketId: storeId } });
    await db.supermarket.deleteMany({ where: { ownerId } });
    await db.product.deleteMany({ where: { name: { startsWith: tag } } });
    await db.user.deleteMany({ where: { email: { endsWith: `@${tag}.test` } } });
    await mock?.close();
  });

  it("marks shelf prices up (₦10,000 → ₦11,400) and keeps the margin as SubNet's share", async () => {
    const inv = await db.inventory.findUniqueOrThrow({ where: { id: rice } });
    expect(inv).toMatchObject({ shelfPriceKobo: 1_000_000, priceKobo: 1_140_000 });
    const c = await customer();
    await cart(c.userId, 2);
    const orderId = await placeOrder({ customerId: c.userId, supermarketId: storeId, checkoutKey: `${tag}-pick`, note: null });
    const o = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    expect(o.subtotalKobo).toBe(2_280_000);
    expect(o.commissionKobo).toBe(280_000);
    expect(o.items[0].shelfPriceKobo).toBe(1_000_000);
    await changeOrderStatus({ orderId, actor: "STORE", actorId: ownerId, to: "CANCELLED", reason: "Test" });
  });

  it("takes online payment through Monnify and refunds through Monnify", async () => {
    expect(activeProvider()).toBe("MONNIFY");
    const c = await customer();
    await cart(c.userId, 1);
    const orderId = await placeOrder({ customerId: c.userId, supermarketId: storeId, checkoutKey: `${tag}-online`, note: null, paymentMethod: "ONLINE" });
    const url = await startOnlinePayment({ orderId, customerId: c.userId, appUrl: "http://app.test" });
    expect(url).toContain(`localhost:${PORT}/checkout/`);
    const p = await db.payment.findFirstOrThrow({ where: { orderId } });
    expect(p.provider).toBe("MONNIFY");
    // Not paid yet: stays pending.
    expect((await verifyAndApply(p.reference)).outcome).toBe("pending");
    await fetch(`http://localhost:${PORT}/__control/pay/${encodeURIComponent(p.reference)}?webhook=0`, { method: "POST" });
    // The webhook path and the redirect both end in the same single application.
    await handleMonnifyEvent({ eventType: "SUCCESSFUL_TRANSACTION", eventData: { paymentReference: p.reference } });
    expect((await verifyAndApply(p.reference)).outcome).toBe("already-processed");
    let o = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(o).toMatchObject({ status: "PLACED", paymentStatus: "PAID" });
    await changeOrderStatus({ orderId, actor: "STORE", actorId: ownerId, to: "CANCELLED", reason: "Out of stock" });
    const refunds = await db.refund.findMany({ where: { payment: { orderId } } });
    expect(refunds).toHaveLength(1);
    expect(refunds[0].amountKobo).toBe(o.totalKobo);
    expect(mock.refunds.at(-1).refundAmount).toBe(o.totalKobo / 100);
    await handleMonnifyEvent({ eventType: "SUCCESSFUL_REFUND", eventData: { refundReference: refunds[0].id } });
    expect((await db.refund.findUniqueOrThrow({ where: { id: refunds[0].id } })).status).toBe("PROCESSED");
    o = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(o.status).toBe("CANCELLED");
  });

  async function codDelivered(qty: number) {
    const c = await customer();
    await cart(c.userId, qty);
    const orderId = await placeOrder({ customerId: c.userId, supermarketId: storeId, checkoutKey: `${tag}-cod-${seq++}`, note: null, paymentMethod: "CASH_ON_DELIVERY", fulfilment: "DELIVERY", addressId: c.addressId });
    await changeOrderStatus({ orderId, actor: "STORE", actorId: ownerId, to: "CONFIRMED" });
    const a = await deliveries.acceptDelivery(await rider(), orderId);
    await changeOrderStatus({ orderId, actor: "STORE", actorId: ownerId, to: "READY_FOR_PICKUP" });
    await deliveries.markPickedUp(await rider(), a.id);
    const pin = (await db.order.findUniqueOrThrow({ where: { id: orderId } })).pickupPin;
    await deliveries.completeDelivery(await rider(), a.id, pin);
    return db.order.findUniqueOrThrow({ where: { id: orderId } });
  }

  it("refuses cash for pickup and for orders over the cash limit", async () => {
    const c = await customer();
    await cart(c.userId, 5); // ₦57,000 + delivery
    await expect(
      placeOrder({ customerId: c.userId, supermarketId: storeId, checkoutKey: `${tag}-big`, note: null, paymentMethod: "CASH_ON_DELIVERY", fulfilment: "DELIVERY", addressId: c.addressId }),
    ).rejects.toThrow(/must be paid online/);
    await expect(placeOrder({ customerId: c.userId, supermarketId: storeId, checkoutKey: `${tag}-cpick`, note: null, paymentMethod: "CASH_ON_DELIVERY" })).rejects.toThrow(/only for delivery/);
    await db.cartItem.deleteMany({ where: { userId: c.userId } });
  });

  it("debits the rider for cash collected, and pauses them at the limit", async () => {
    const first = await codDelivered(1);
    expect(first).toMatchObject({ status: "DELIVERED", paymentStatus: "PAID" });
    let r = await rider();
    expect(r.walletBalanceKobo).toBe(-first.totalKobo);
    expect(r.cashBlockedAt).toBeNull();
    // A second cash job that would take them past ₦20,000 isn't offered.
    const c = await customer();
    await cart(c.userId, 1);
    const nextId = await placeOrder({ customerId: c.userId, supermarketId: storeId, checkoutKey: `${tag}-cod-next`, note: null, paymentMethod: "CASH_ON_DELIVERY", fulfilment: "DELIVERY", addressId: c.addressId });
    await changeOrderStatus({ orderId: nextId, actor: "STORE", actorId: ownerId, to: "CONFIRMED" });
    expect((await deliveries.availableDeliveries(r)).some((j) => j.order.id === nextId)).toBe(false);
    await expect(deliveries.acceptDelivery(r, nextId)).rejects.toThrow(/too much cash/);
    // Lower the limit below what they hold: the next posting pauses them.
    await saveSettings({ riderMaxCashDebt: "5000" }, "test");
    await wallet.creditRemittance({ riderId, amountKobo: 100, note: "tiny", type: "ADJUSTMENT" });
    r = await rider();
    expect(r.cashBlockedAt).not.toBeNull();
    expect(await deliveries.availableDeliveries(r)).toEqual([]);
    await expect(deliveries.acceptDelivery(r, nextId)).rejects.toThrow(/Account paused/);
    await saveSettings({ riderMaxCashDebt: "20000" }, "test");
    await changeOrderStatus({ orderId: nextId, actor: "STORE", actorId: ownerId, to: "CANCELLED", reason: "Test" });
  });

  it("gives the rider a virtual account and credits transfers into it exactly once", async () => {
    const acct = await wallet.ensureVirtualAccount(riderId);
    expect(acct?.virtualAccountNumber).toMatch(/^\d{10}$/);
    expect((await wallet.ensureVirtualAccount(riderId))?.virtualAccountNumber).toBe(acct?.virtualAccountNumber);
    const owed = -(await rider()).walletBalanceKobo;
    const res = await fetch(`http://localhost:${PORT}/__control/transfer-in/${encodeURIComponent(acct!.virtualAccountRef!)}?amount=${owed / 100}&webhook=0`, { method: "POST" });
    const tx = await res.json();
    const event = { eventType: "SUCCESSFUL_TRANSACTION", eventData: tx };
    await Promise.all([handleMonnifyEvent(event), handleMonnifyEvent(event)]);
    const r = await rider();
    expect(r.walletBalanceKobo).toBe(0);
    expect(r.cashBlockedAt).toBeNull();
    expect(await db.riderWalletEntry.count({ where: { riderId, type: "REMITTANCE" } })).toBe(1);
  });

  it("pays each store once a night at 22:00, its shelf-price share in one transfer", async () => {
    const before = await runDailySettlement(new Date()).then(() => db.settlement.findMany({ where: { supermarketId: storeId } }));
    // The COD order from earlier was settled just now; check it.
    const s = before.find((x) => x.orderCount > 0)!;
    expect(s.status).toBe("PAID");
    expect(s.payableKobo).toBe(1_000_000); // one rice at shelf price; delivery fee excluded
    const d = mock.disbursements.find((x: { reference: string }) => x.reference === s.payoutReference);
    expect(d).toMatchObject({ amount: 10_000, destinationAccountNumber: "0123456789", sourceAccountNumber: "9999999999" });

    // The scheduler only fires from 22:00 Lagos and once per day.
    await db.platformSetting.deleteMany({ where: { key: "dailySettlementDay" } });
    expect(await maybeRunDailySettlement(new Date("2026-11-23T20:30:00Z"))).toBeNull(); // 21:30 WAT
    expect(await maybeRunDailySettlement(new Date("2026-11-23T21:05:00Z"))).not.toBeNull(); // 22:05 WAT
    expect(await maybeRunDailySettlement(new Date("2026-11-23T22:00:00Z"))).toBeNull(); // same day
  });

  it("marks a payout failed when the bank rejects it, and retries it later", async () => {
    await db.supermarket.update({ where: { id: storeId }, data: { bankAccountNumber: "0000000000" } });
    await codDelivered(1);
    await db.riderWalletEntry.deleteMany({ where: { riderId } });
    await db.rider.update({ where: { id: riderId }, data: { walletBalanceKobo: 0, cashBlockedAt: null } });
    await runDailySettlement(new Date());
    let s = await db.settlement.findFirstOrThrow({ where: { supermarketId: storeId }, orderBy: { createdAt: "desc" } });
    expect(s.status).toBe("FAILED");
    await db.supermarket.update({ where: { id: storeId }, data: { bankAccountNumber: "0123456789" } });
    await runDailySettlement(new Date(Date.now() + 1000));
    s = await db.settlement.findUniqueOrThrow({ where: { id: s.id } });
    expect(s.status).toBe("PAID");
  });
});
