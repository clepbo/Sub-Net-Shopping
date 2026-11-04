// Integration test against a real Postgres (uses DATABASE_URL; skipped without it).
import "dotenv/config";
import { createECDH, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import webpush from "web-push";

const enabled = Boolean(process.env.DATABASE_URL);
const keys = webpush.generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY = keys.publicKey;
process.env.VAPID_PRIVATE_KEY = keys.privateKey;

describe.skipIf(!enabled)("pickup reminders (database)", async () => {
  const { db } = await import("../db");
  const { placeOrder } = await import("../orders");
  const { sendPickupReminders } = await import("../reminders");

  const tag = `r${Date.now()}`;
  let storeId = "";
  let customerId = "";
  let inventoryId = "";
  // Push services are HTTPS-only, so capture what would be sent instead.
  const send = vi.spyOn(webpush, "sendNotification").mockResolvedValue({ statusCode: 201, body: "", headers: {} });

  beforeAll(async () => {
    const owner = await db.user.create({ data: { role: "SUPERMARKET", firstName: "O", lastName: "T", email: `o@${tag}.test`, phone: `+23490${String(Date.now()).slice(-8)}`, passwordHash: "x" } });
    storeId = (
      await db.supermarket.create({
        data: {
          ownerId: owner.id,
          name: `${tag} Mart`,
          contactName: "O",
          phone: "+2348000000000",
          email: `s@${tag}.test`,
          address: "1 Road",
          status: "APPROVED",
          pickupPrepMinutes: 15,
          hours: { create: Array.from({ length: 7 }, (_, d) => ({ dayOfWeek: d, isOpen: true, opensAt: "00:00", closesAt: "23:59" })) },
        },
      })
    ).id;
    const p = await db.product.create({ data: { name: `${tag} Bread` } });
    inventoryId = (await db.inventory.create({ data: { supermarketId: storeId, productId: p.id, sku: "B", priceKobo: 100_000, stockQuantity: null } })).id;
    const c = await db.user.create({ data: { role: "CUSTOMER", firstName: "C", lastName: "T", email: `c@${tag}.test`, phone: `+23491${String(Date.now()).slice(-8)}`, passwordHash: "x" } });
    customerId = c.id;
    const ecdh = createECDH("prime256v1");
    ecdh.generateKeys();
    await db.pushSubscription.create({
      data: { userId: customerId, endpoint: `https://push.example.test/${tag}`, p256dh: ecdh.getPublicKey("base64url"), auth: randomBytes(16).toString("base64url") },
    });
  });

  afterAll(async () => {
    await db.order.deleteMany({ where: { supermarketId: storeId } });
    await db.supermarket.deleteMany({ where: { id: storeId } });
    await db.product.deleteMany({ where: { name: { startsWith: tag } } });
    await db.user.deleteMany({ where: { email: { endsWith: `@${tag}.test` } } });
    send.mockRestore();
  });

  it("reminds once, about an hour before the chosen pickup time, in-app and by push", async () => {
    await db.cartItem.create({ data: { userId: customerId, inventoryId, quantity: 1 } });
    const id = await placeOrder({ customerId, supermarketId: storeId, checkoutKey: `${tag}-1`, note: null });
    // Pretend the customer chose a time 3 hours from now.
    const pickupAt = new Date(Date.now() + 3 * 3_600_000);
    await db.order.update({ where: { id }, data: { pickupAt, pickupReminderSentAt: null } });

    expect(await sendPickupReminders(new Date())).toBe(0); // too early
    const soon = new Date(pickupAt.getTime() - 50 * 60_000);
    const [a, b] = await Promise.all([sendPickupReminders(soon), sendPickupReminders(soon)]);
    expect(a + b).toBe(1); // overlapping runs send it once
    expect(await sendPickupReminders(soon)).toBe(0);
    expect(await db.notification.count({ where: { userId: customerId, title: { startsWith: "Pickup reminder" } } })).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    const [sub, payload] = send.mock.calls[0];
    expect(sub.endpoint).toBe(`https://push.example.test/${tag}`);
    expect(JSON.parse(String(payload))).toMatchObject({ title: expect.stringMatching(/^Pickup reminder/), url: `/orders/${id}` });
  });

  it("skips the reminder when the pickup is less than an hour away at checkout", async () => {
    await db.cartItem.create({ data: { userId: customerId, inventoryId, quantity: 1 } });
    const id = await placeOrder({ customerId, supermarketId: storeId, checkoutKey: `${tag}-2`, note: null });
    const order = await db.order.findUniqueOrThrow({ where: { id } });
    expect(order.pickupAt!.getTime() - Date.now()).toBeLessThan(3_600_000); // earliest slot, ~15–45 min away
    expect(order.pickupReminderSentAt).not.toBeNull();
  });
});
