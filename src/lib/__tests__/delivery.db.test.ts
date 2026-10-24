// Integration tests against a real Postgres and the mock Paystack server
// (uses DATABASE_URL; skipped without it).
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startMockPaystack } from "../../../scripts/mock-paystack.mjs";

const enabled = Boolean(process.env.DATABASE_URL);
const PORT = 4322;
process.env.PAYSTACK_SECRET_KEY = "sk_test_vitest";
process.env.PAYSTACK_BASE_URL = `http://localhost:${PORT}`;

describe.skipIf(!enabled)("delivery (database)", async () => {
  const { db } = await import("../db");
  const { placeOrder, changeOrderStatus } = await import("../orders");
  const { startOnlinePayment, verifyAndApply } = await import("../payments");
  const deliveries = await import("../deliveries");
  const { findOrderForPickup } = await import("../pickup");
  const { createSettlement } = await import("../settlements");
  const { createRiderPayout, markRiderPayoutPaid } = await import("../rider-payouts");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mock: any;
  const tag = `d${Date.now()}`;
  let seq = 0;
  const phone = () => `+23481${String(Date.now() + seq++).slice(-8)}`;
  let storeId = "";
  let ownerId = "";
  let rice = "";
  let fridge = "";
  const riders: Record<string, Awaited<ReturnType<typeof makeRider>>> = {};

  async function makeRider(name: string, vehicleType: "MOTORCYCLE" | "VAN") {
    const u = await db.user.create({ data: { role: "RIDER", firstName: name, lastName: "R", email: `${name}@${tag}.test`, phone: phone(), passwordHash: "x" } });
    return db.rider.create({ data: { userId: u.id, vehicleType, plateNumber: name, status: "APPROVED", isOnline: true } });
  }
  async function paidDeliveryOrder(lines: [string, number][]) {
    const u = await db.user.create({ data: { role: "CUSTOMER", firstName: "C", lastName: "T", email: `c${seq++}@${tag}.test`, phone: phone(), passwordHash: "x" } });
    const addr = await db.customerAddress.create({ data: { userId: u.id, label: "Home", address: "5 Ugbowo Road", phone: "+2348030000000", latitude: 6.335, longitude: 5.627 } });
    for (const [inventoryId, quantity] of lines) await db.cartItem.create({ data: { userId: u.id, inventoryId, quantity } });
    const orderId = await placeOrder({ customerId: u.id, supermarketId: storeId, checkoutKey: `${tag}-${seq++}`, note: null, paymentMethod: "ONLINE", fulfilment: "DELIVERY", addressId: addr.id });
    await startOnlinePayment({ orderId, customerId: u.id, appUrl: "http://app.test" });
    const p = await db.payment.findFirstOrThrow({ where: { orderId } });
    await fetch(`http://localhost:${PORT}/__control/pay/${p.reference}?webhook=0`, { method: "POST" });
    await verifyAndApply(p.reference);
    return { orderId, customerId: u.id, addressId: addr.id };
  }
  const order = (id: string) => db.order.findUniqueOrThrow({ where: { id }, include: { delivery: true, payments: { include: { refunds: true } } } });

  beforeAll(async () => {
    mock = await startMockPaystack({ port: PORT, secret: "sk_test_vitest" });
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
          latitude: 6.3176,
          longitude: 5.6145,
          deliveryEnabled: true,
          hours: { create: Array.from({ length: 7 }, (_, d) => ({ dayOfWeek: d, isOpen: true, opensAt: "00:00", closesAt: "23:59" })) },
          staff: { create: { userId: ownerId, role: "MANAGER" } },
        },
      })
    ).id;
    const listing = async (name: string, priceKobo: number, isBulky = false) => {
      const p = await db.product.create({ data: { name: `${tag} ${name}`, isBulky } });
      return (await db.inventory.create({ data: { supermarketId: storeId, productId: p.id, sku: name, priceKobo, stockQuantity: 100 } })).id;
    };
    rice = await listing("Rice", 1_250_000);
    fridge = await listing("Fridge", 35_000_000, true);
    riders.bike = await makeRider("bike", "MOTORCYCLE");
    riders.bike2 = await makeRider("bike2", "MOTORCYCLE");
    riders.van = await makeRider("van", "VAN");
  });

  afterAll(async () => {
    await db.order.deleteMany({ where: { supermarketId: storeId } });
    await db.settlement.deleteMany({ where: { supermarketId: storeId } });
    await db.riderPayout.deleteMany({ where: { riderId: { in: Object.values(riders).map((r) => r.id) } } });
    await db.supermarket.deleteMany({ where: { id: storeId } });
    await db.product.deleteMany({ where: { name: { startsWith: tag } } });
    await db.user.deleteMany({ where: { email: { endsWith: `@${tag}.test` } } });
    await mock?.close();
  });

  it("prices delivery into the order and requires online payment and an address", async () => {
    const { orderId } = await paidDeliveryOrder([[rice, 1]]);
    const o = await order(orderId);
    expect(o).toMatchObject({ fulfilment: "DELIVERY", requiredVehicle: "MOTORCYCLE", status: "PLACED", paymentStatus: "PAID" });
    expect(o.deliveryFeeKobo).toBeGreaterThan(0);
    expect(o.totalKobo).toBe(1_250_000 + o.deliveryFeeKobo);
    expect(o.commissionKobo).toBe(125_000); // on products only

    const u = await db.user.create({ data: { role: "CUSTOMER", firstName: "C", lastName: "T", email: `x${seq++}@${tag}.test`, phone: phone(), passwordHash: "x" } });
    await db.cartItem.create({ data: { userId: u.id, inventoryId: rice, quantity: 1 } });
    await expect(placeOrder({ customerId: u.id, supermarketId: storeId, checkoutKey: `${tag}-cash`, note: null, fulfilment: "DELIVERY" })).rejects.toThrow(/paid online/);
    await expect(placeOrder({ customerId: u.id, supermarketId: storeId, checkoutKey: `${tag}-noaddr`, note: null, paymentMethod: "ONLINE", fulfilment: "DELIVERY" })).rejects.toThrow(/address/);
  });

  it("matches bulky items to vans and lets only one rider win a job", async () => {
    const { orderId } = await paidDeliveryOrder([[fridge, 1]]);
    expect((await order(orderId)).requiredVehicle).toBe("VAN");
    await changeOrderStatus({ orderId, actor: "STORE", actorId: ownerId, to: "CONFIRMED" });
    expect((await deliveries.availableDeliveries(riders.bike)).some((d) => d.order.id === orderId)).toBe(false);
    expect((await deliveries.availableDeliveries(riders.van)).some((d) => d.order.id === orderId)).toBe(true);
    await expect(deliveries.acceptDelivery(riders.bike, orderId)).rejects.toThrow(/bigger vehicle/);
    await deliveries.acceptDelivery(riders.van, orderId);
    await expect(deliveries.acceptDelivery(riders.van, orderId)).rejects.toThrow(/current delivery/);
    // Clean up so the van is free for later tests.
    await changeOrderStatus({ orderId, actor: "STORE", actorId: ownerId, to: "CANCELLED", reason: "Test" });
  });

  it("gives a job to exactly one of two riders racing to accept", async () => {
    const { orderId } = await paidDeliveryOrder([[rice, 1]]);
    await changeOrderStatus({ orderId, actor: "STORE", actorId: ownerId, to: "CONFIRMED" });
    const results = await Promise.allSettled([deliveries.acceptDelivery(riders.bike, orderId), deliveries.acceptDelivery(riders.bike2, orderId)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const a = await db.deliveryAssignment.findUniqueOrThrow({ where: { orderId } });
    const winner = a.riderId === riders.bike.id ? riders.bike : riders.bike2;
    // Hand it back: it becomes available again.
    await deliveries.releaseDelivery(winner, a.id);
    expect(await db.deliveryAssignment.findUnique({ where: { orderId } })).toBeNull();
    await changeOrderStatus({ orderId, actor: "STORE", actorId: ownerId, to: "CANCELLED", reason: "Test" });
  });

  it("runs pickup → delivery with the customer's PIN and makes the earning payable", async () => {
    const { orderId } = await paidDeliveryOrder([[rice, 2]]);
    await changeOrderStatus({ orderId, actor: "STORE", actorId: ownerId, to: "CONFIRMED" });
    const a = await deliveries.acceptDelivery(riders.bike, orderId);
    expect(a.earningStatus).toBe("PENDING");
    expect(a.riderEarningKobo).toBe(a.deliveryFeeKobo - Math.round((a.deliveryFeeKobo * a.riderCommissionPercent) / 100));
    await expect(deliveries.markPickedUp(riders.bike, a.id)).rejects.toThrow(/hasn't marked this order ready/);
    await changeOrderStatus({ orderId, actor: "STORE", actorId: ownerId, to: "READY_FOR_PICKUP" });
    // The counter must not release a delivery order against the customer's PIN.
    expect(await findOrderForPickup(storeId, { pin: (await order(orderId)).pickupPin })).toMatchObject({ ok: false });
    await deliveries.markPickedUp(riders.bike, a.id);
    expect(await order(orderId)).toMatchObject({ status: "OUT_FOR_DELIVERY", delivery: { status: "PICKED_UP" } });
    await expect(changeOrderStatus({ orderId, actor: "STORE", actorId: ownerId, to: "CANCELLED", reason: "x" })).rejects.toThrow();
    await deliveries.recordLocation(riders.bike, 6.33, 5.62);
    expect((await db.rider.findUniqueOrThrow({ where: { id: riders.bike.id } })).lastLat).toBe(6.33);
    await expect(deliveries.completeDelivery(riders.bike, a.id, "999999x")).rejects.toThrow(/doesn't match/);
    await deliveries.completeDelivery(riders.bike, a.id, (await order(orderId)).pickupPin);
    expect(await order(orderId)).toMatchObject({ status: "DELIVERED", delivery: { status: "DELIVERED", earningStatus: "ELIGIBLE" } });
  });

  it("voids the rider's job and refunds everything when the store cancels", async () => {
    const { orderId } = await paidDeliveryOrder([[rice, 1]]);
    await changeOrderStatus({ orderId, actor: "STORE", actorId: ownerId, to: "CONFIRMED" });
    await deliveries.acceptDelivery(riders.bike2, orderId);
    await changeOrderStatus({ orderId, actor: "STORE", actorId: ownerId, to: "CANCELLED", reason: "Out of rice" });
    const o = await order(orderId);
    expect(o.delivery).toMatchObject({ status: "CANCELLED", earningStatus: "VOID" });
    expect(o.payments[0].refunds[0].amountKobo).toBe(o.totalKobo);
  });

  it("settles the store without the delivery fee and pays riders their earnings", async () => {
    const s = await createSettlement(storeId, ownerId);
    // One delivered ₦25,000 rice order: store gets sales minus 10%.
    expect(s).toMatchObject({ orderCount: 1, grossKobo: 2_500_000, commissionKobo: 250_000, onlineNetKobo: 2_250_000, payableKobo: 2_250_000 });
    const payout = await createRiderPayout(riders.bike.id, ownerId);
    expect(payout?.deliveryCount).toBe(1);
    await markRiderPayoutPaid(payout!.id, "TRF-1");
    expect((await db.deliveryAssignment.findFirstOrThrow({ where: { riderId: riders.bike.id, status: "DELIVERED" } })).earningStatus).toBe("PAID");
    expect(await createRiderPayout(riders.bike.id, ownerId)).toBeNull();
  });
});
