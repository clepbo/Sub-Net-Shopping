import "server-only";
// Checkout and order changes. Every rule is enforced here on the server:
// prices and stock come from the database at checkout, stock is reserved
// atomically, and status changes follow order-rules.ts.
import { db } from "./db";
import { computeAvailability } from "./availability";
import { pickupBlocker } from "./cart";
import { deriveAvailability, listingStatusOf, VISIBLE_AVAILABILITY } from "./inventory";
import { canAdjustItems, canTransition, newOrderNumber, orderTotals, ORDER_STATUS_LABEL, type OrderActor } from "./order-rules";
import { Prisma } from "@/generated/prisma/client";
import type { OrderStatus } from "@/generated/prisma/enums";

type Tx = Prisma.TransactionClient;

export class OrderError extends Error {}

/** Takes `quantity` from tracked stock; false when stock isn't tracked. Throws if too little is left. */
async function reserveStock(tx: Tx, inventoryId: string, quantity: number, name: string): Promise<boolean> {
  const listing = await tx.inventory.findUniqueOrThrow({ where: { id: inventoryId }, select: { stockQuantity: true } });
  if (listing.stockQuantity === null) return false;
  // Conditional decrement: two checkouts racing for the last items can't both succeed.
  const updated = await tx.inventory.updateMany({
    where: { id: inventoryId, stockQuantity: { gte: quantity } },
    data: { stockQuantity: { decrement: quantity } },
  });
  if (updated.count === 0) throw new OrderError(`Not enough “${name}” left in stock`);
  await refreshAvailability(tx, inventoryId);
  return true;
}

async function releaseStock(tx: Tx, inventoryId: string | null, quantity: number) {
  if (!inventoryId || quantity <= 0) return;
  const updated = await tx.inventory.updateMany({
    where: { id: inventoryId, stockQuantity: { not: null } },
    data: { stockQuantity: { increment: quantity } },
  });
  if (updated.count) await refreshAvailability(tx, inventoryId);
}

/** Keeps in/low/out-of-stock in step with the quantity, respecting "hidden". */
async function refreshAvailability(tx: Tx, inventoryId: string) {
  const l = await tx.inventory.findUniqueOrThrow({ where: { id: inventoryId }, select: { availability: true, stockQuantity: true } });
  const status = listingStatusOf(l.availability) === "HIDDEN" ? "HIDDEN" : "AVAILABLE";
  await tx.inventory.update({ where: { id: inventoryId }, data: { availability: deriveAvailability(status, l.stockQuantity) } });
}

async function notifyStoreStaff(tx: Tx, supermarketId: string, title: string, body: string) {
  const staff = await tx.supermarketStaff.findMany({ where: { supermarketId }, select: { userId: true } });
  if (staff.length) await tx.notification.createMany({ data: staff.map((s) => ({ userId: s.userId, title, body })) });
}

/**
 * Turns the customer's cart lines for one supermarket into an order.
 * Re-submitting the same checkoutKey returns the first order.
 */
export async function placeOrder(opts: { customerId: string; supermarketId: string; checkoutKey: string; note: string | null; now?: Date }) {
  const { customerId, supermarketId, checkoutKey } = opts;
  const existing = await db.order.findUnique({ where: { checkoutKey }, select: { id: true, customerId: true } });
  if (existing) {
    if (existing.customerId !== customerId) throw new OrderError("This checkout has expired. Please try again.");
    return existing.id;
  }

  const store = await db.supermarket.findUnique({ where: { id: supermarketId }, include: { hours: true } });
  if (!store || store.status !== "APPROVED") throw new OrderError("This supermarket isn't available on Sub Net right now.");
  const blocker = pickupBlocker(computeAvailability(store, opts.now ?? new Date()));
  if (blocker) throw new OrderError(blocker);

  const lines = await db.cartItem.findMany({
    where: { userId: customerId, inventory: { supermarketId } },
    include: { inventory: { include: { product: true } } },
    orderBy: { createdAt: "asc" },
  });
  if (lines.length === 0) throw new OrderError("Your cart has no items from this supermarket.");
  for (const l of lines) {
    if (!VISIBLE_AVAILABILITY.includes(l.inventory.availability) || l.inventory.availability === "OUT_OF_STOCK") {
      throw new OrderError(`“${l.inventory.product.name}” is no longer available. Remove it to continue.`);
    }
  }

  const items = lines.map((l) => ({
    inventoryId: l.inventoryId,
    productId: l.inventory.productId,
    name: l.inventory.product.name,
    unit: l.inventory.product.unit,
    sku: l.inventory.sku,
    unitPriceKobo: l.inventory.priceKobo,
    requestedQuantity: l.quantity,
    quantity: l.quantity,
    lineTotalKobo: l.inventory.priceKobo * l.quantity,
  }));
  const totals = orderTotals(items);

  let number = newOrderNumber();
  while (await db.order.findUnique({ where: { number }, select: { id: true } })) number = newOrderNumber();

  try {
    return await db.$transaction(async (tx) => {
      const reserved: boolean[] = [];
      for (const item of items) reserved.push(await reserveStock(tx, item.inventoryId, item.quantity, item.name));
      const order = await tx.order.create({
        data: {
          number,
          customerId,
          supermarketId,
          checkoutKey,
          customerNote: opts.note,
          ...totals,
          items: { create: items.map((item, i) => ({ ...item, stockReserved: reserved[i] })) },
          events: { create: { status: "PLACED", actorId: customerId } },
        },
      });
      await tx.cartItem.deleteMany({ where: { userId: customerId, inventory: { supermarketId } } });
      await tx.notification.create({
        data: { userId: customerId, title: `Order ${number} placed`, body: `${store.name} will confirm your order shortly. You'll pay at the store when you collect.` },
      });
      await notifyStoreStaff(tx, supermarketId, `New order ${number}`, `${items.length} item${items.length === 1 ? "" : "s"} for pickup. Confirm it from your Orders page.`);
      return order.id;
    });
  } catch (err) {
    // A double-submit that lost the race to the first one.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const order = await db.order.findUnique({ where: { checkoutKey }, select: { id: true, customerId: true } });
      if (order?.customerId === customerId) return order.id;
    }
    throw err;
  }
}

const TIMESTAMP: Partial<Record<OrderStatus, "confirmedAt" | "readyAt" | "collectedAt" | "cancelledAt">> = {
  CONFIRMED: "confirmedAt",
  READY_FOR_PICKUP: "readyAt",
  COLLECTED: "collectedAt",
  CANCELLED: "cancelledAt",
};

const CUSTOMER_MESSAGE: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: "The supermarket has confirmed your order and is preparing it.",
  READY_FOR_PICKUP: "Your order is ready. Show your order number at the pickup point and pay there.",
  COLLECTED: "Thanks for shopping with Sub Net!",
};

/**
 * Moves an order to a new status. The order is locked and its status
 * re-checked inside the transaction so two staff can't act on it at once.
 */
export async function changeOrderStatus(opts: { orderId: string; actor: OrderActor; actorId: string; to: OrderStatus; reason?: string | null }) {
  const { orderId, actor, actorId, to } = opts;
  if (to === "CANCELLED" && actor === "STORE" && !opts.reason) throw new OrderError("Give the customer a reason for cancelling");

  return db.$transaction(async (tx) => {
    // Row lock so concurrent changes run one after the other.
    await tx.$queryRaw`SELECT 1 FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true, supermarket: { select: { name: true } } } });
    if (!canTransition(actor, order.status, to)) {
      throw new OrderError(`This order is already ${ORDER_STATUS_LABEL[order.status].toLowerCase()}`);
    }
    if (to === "CANCELLED") {
      for (const item of order.items) if (item.stockReserved) await releaseStock(tx, item.inventoryId, item.quantity);
    }
    const stamp = TIMESTAMP[to];
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: to,
        ...(stamp ? { [stamp]: new Date() } : {}),
        ...(to === "COLLECTED" && order.paymentMethod === "PAY_AT_STORE" ? { paymentStatus: "PAID" as const } : {}),
        // A reason is only recorded for store cancellations; the customer knows why they cancelled.
        ...(to === "CANCELLED" ? { cancelReason: actor === "STORE" ? opts.reason : null } : {}),
      },
    });
    const note = to === "CANCELLED" ? (actor === "CUSTOMER" ? "Cancelled by the customer" : `Cancelled by the supermarket: ${opts.reason}`) : null;
    await tx.orderEvent.create({ data: { orderId, status: to, actorId, note } });

    if (actor === "STORE") {
      const body = to === "CANCELLED" ? `${order.supermarket.name} cancelled your order. Reason: ${opts.reason}` : CUSTOMER_MESSAGE[to];
      if (body) await tx.notification.create({ data: { userId: order.customerId, title: `Order ${order.number}: ${ORDER_STATUS_LABEL[to].toLowerCase()}`, body } });
    } else {
      await notifyStoreStaff(tx, order.supermarketId, `Order ${order.number} cancelled`, "The customer cancelled this order.");
    }
    return order;
  });
}

/**
 * Lets the store supply fewer of an item than requested (e.g. it ran out)
 * before confirming. Reserved stock is returned and totals recalculated.
 */
export async function adjustOrderItem(opts: { supermarketId: string; orderItemId: string; quantity: number; actorId: string }) {
  return db.$transaction(async (tx) => {
    const item = await tx.orderItem.findUnique({ where: { id: opts.orderItemId }, include: { order: true } });
    if (!item || item.order.supermarketId !== opts.supermarketId) throw new OrderError("Item not found");
    await tx.$queryRaw`SELECT 1 FROM "Order" WHERE "id" = ${item.orderId} FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({ where: { id: item.orderId }, include: { items: true } });
    if (!canAdjustItems(order.status)) throw new OrderError("Items can only be changed before the order is confirmed");
    if (!Number.isInteger(opts.quantity) || opts.quantity < 0 || opts.quantity > item.requestedQuantity) {
      throw new OrderError(`Choose between 0 and ${item.requestedQuantity}`);
    }
    if (opts.quantity === item.quantity) return order;
    const remaining = order.items.reduce((n, i) => n + (i.id === item.id ? opts.quantity : i.quantity), 0);
    if (remaining === 0) throw new OrderError("Every item would be removed. Cancel the order instead.");

    if (item.stockReserved && opts.quantity < item.quantity) await releaseStock(tx, item.inventoryId, item.quantity - opts.quantity);
    if (item.stockReserved && opts.quantity > item.quantity && item.inventoryId) {
      await reserveStock(tx, item.inventoryId, opts.quantity - item.quantity, item.name);
    }
    await tx.orderItem.update({ where: { id: item.id }, data: { quantity: opts.quantity, lineTotalKobo: item.unitPriceKobo * opts.quantity } });
    const items = order.items.map((i) => (i.id === item.id ? { ...i, quantity: opts.quantity } : i));
    await tx.order.update({ where: { id: order.id }, data: orderTotals(items, order.deliveryFeeKobo) });
    const note = opts.quantity === 0 ? `Removed ${item.name} (unavailable)` : `${item.name}: ${item.quantity} → ${opts.quantity}`;
    await tx.orderEvent.create({ data: { orderId: order.id, status: order.status, actorId: opts.actorId, note } });
    await tx.notification.create({
      data: { userId: order.customerId, title: `Order ${order.number} updated`, body: `The supermarket changed your order: ${note}. Your new total is on the order page.` },
    });
    return order;
  });
}
