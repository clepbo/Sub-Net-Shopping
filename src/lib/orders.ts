import "server-only";
// Checkout and order changes. Every rule is enforced here on the server:
// prices and stock come from the database at checkout, stock is reserved
// atomically, and status changes follow order-rules.ts.
import { randomBytes, randomInt } from "node:crypto";
import { db } from "./db";
import { computeAvailability } from "./availability";
import { deliveryBlocker, pickupBlocker } from "./cart";
import { canCarry, deliveryQuote, VEHICLE_NAME } from "./delivery-rules";
import { VISIBLE_AVAILABILITY } from "./inventory";
import {
  ACTIVE_STATUSES,
  canAdjustItems,
  canTransition,
  commissionOn,
  newOrderNumber,
  orderTotals,
  ORDER_STATUS_LABEL,
  type OrderActor,
} from "./order-rules";
import { deliveryRates, getSettings } from "./settings";
import { announceNewOrder, notifyStoreStaff } from "./order-notify";
import { releaseStock, reserveStock, StockError } from "./stock";
import { refundOrderBalance } from "./payments";
import { paystackConfigured } from "./payments/paystack";
import { Prisma } from "@/generated/prisma/client";
import type { Fulfilment, OrderStatus, PaymentMethod, VehicleType } from "@/generated/prisma/enums";

type Tx = Prisma.TransactionClient;

export class OrderError extends Error {}

/** A 6-digit PIN not used by another open order at this store, and a QR token. */
async function pickupCredentials(tx: Tx, supermarketId: string) {
  for (;;) {
    const pin = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const clash = await tx.order.findFirst({ where: { supermarketId, pickupPin: pin, status: { in: ACTIVE_STATUSES } }, select: { id: true } });
    if (!clash) return { pickupPin: pin, pickupToken: randomBytes(24).toString("base64url") };
  }
}

/**
 * Turns the customer's cart lines for one supermarket into an order.
 * Re-submitting the same checkoutKey returns the first order. Online
 * orders wait for payment before the store sees them.
 */
export async function placeOrder(opts: {
  customerId: string;
  supermarketId: string;
  checkoutKey: string;
  note: string | null;
  paymentMethod?: PaymentMethod;
  fulfilment?: Fulfilment;
  /** A saved CustomerAddress, required for delivery. */
  addressId?: string | null;
  now?: Date;
}) {
  const { customerId, supermarketId, checkoutKey } = opts;
  const paymentMethod = opts.paymentMethod ?? "PAY_AT_STORE";
  const fulfilment = opts.fulfilment ?? "PICKUP";
  const existing = await db.order.findUnique({ where: { checkoutKey }, select: { id: true, customerId: true } });
  if (existing) {
    if (existing.customerId !== customerId) throw new OrderError("This checkout has expired. Please try again.");
    return existing.id;
  }
  if (paymentMethod === "ONLINE" && !paystackConfigured()) throw new OrderError("Online payment isn't available right now. Choose pay at the store.");
  // Riders don't handle cash yet (PRD §17), so deliveries are paid online.
  if (fulfilment === "DELIVERY" && paymentMethod !== "ONLINE") throw new OrderError("Delivery orders are paid online.");

  const store = await db.supermarket.findUnique({ where: { id: supermarketId }, include: { hours: true } });
  if (!store || store.status !== "APPROVED") throw new OrderError("This supermarket isn't available on Sub Net right now.");
  const availability = computeAvailability(store, opts.now ?? new Date());
  const blocker = fulfilment === "DELIVERY" ? deliveryBlocker(availability) : pickupBlocker(availability);
  if (blocker) throw new OrderError(blocker);
  const address =
    fulfilment === "DELIVERY" && opts.addressId ? await db.customerAddress.findFirst({ where: { id: opts.addressId, userId: customerId } }) : null;
  if (fulfilment === "DELIVERY" && !address) throw new OrderError("Choose a delivery address.");

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
  let delivery: {
    deliveryAddress: string;
    deliveryLandmark: string | null;
    deliveryPhone: string;
    deliveryLat: number;
    deliveryLng: number;
    deliveryDistanceKm: number;
    requiredVehicle: VehicleType;
  } | null = null;
  let deliveryFeeKobo = 0;
  if (address) {
    const quote = deliveryQuote({
      from: store.latitude !== null && store.longitude !== null ? { lat: store.latitude, lng: store.longitude } : null,
      to: { lat: address.latitude, lng: address.longitude },
      items: lines.map((l) => ({ isBulky: l.inventory.product.isBulky, quantity: l.quantity })),
      rates: await deliveryRates(),
    });
    if (!quote.ok) throw new OrderError(quote.reason);
    deliveryFeeKobo = quote.feeKobo;
    delivery = {
      deliveryAddress: address.address,
      deliveryLandmark: address.landmark,
      deliveryPhone: address.phone,
      deliveryLat: address.latitude,
      deliveryLng: address.longitude,
      deliveryDistanceKm: quote.distanceKm,
      requiredVehicle: quote.vehicle,
    };
  }
  const totals = orderTotals(items, deliveryFeeKobo);
  const commissionPercent = Number((await getSettings()).supermarketCommissionPercent) || 0;

  let number = newOrderNumber();
  while (await db.order.findUnique({ where: { number }, select: { id: true } })) number = newOrderNumber();

  try {
    return await db.$transaction(async (tx) => {
      const reserved: boolean[] = [];
      for (const item of items) reserved.push(await reserveStock(tx, item.inventoryId, item.quantity, item.name));
      const status: OrderStatus = paymentMethod === "ONLINE" ? "AWAITING_PAYMENT" : "PLACED";
      const order = await tx.order.create({
        data: {
          number,
          customerId,
          supermarketId,
          checkoutKey,
          customerNote: opts.note,
          status,
          paymentMethod,
          fulfilment,
          ...delivery,
          ...totals,
          commissionPercent,
          commissionKobo: commissionOn(totals.subtotalKobo, commissionPercent),
          ...(await pickupCredentials(tx, supermarketId)),
          items: { create: items.map((item, i) => ({ ...item, stockReserved: reserved[i] })) },
          events: { create: { status, actorId: customerId } },
        },
      });
      await tx.cartItem.deleteMany({ where: { userId: customerId, inventory: { supermarketId } } });
      if (paymentMethod === "PAY_AT_STORE") {
        await tx.notification.create({
          data: { userId: customerId, title: `Order ${number} placed`, body: `${store.name} will confirm your order shortly. You'll pay at the store when you collect.` },
        });
        await announceNewOrder(tx, order, items.length);
      }
      return order.id;
    });
  } catch (err) {
    if (err instanceof StockError) throw new OrderError(err.message);
    // A double-submit that lost the race to the first one.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const order = await db.order.findUnique({ where: { checkoutKey }, select: { id: true, customerId: true } });
      if (order?.customerId === customerId) return order.id;
    }
    throw err;
  }
}

const TIMESTAMP: Partial<Record<OrderStatus, "confirmedAt" | "readyAt" | "collectedAt" | "cancelledAt" | "outForDeliveryAt" | "deliveredAt">> = {
  CONFIRMED: "confirmedAt",
  READY_FOR_PICKUP: "readyAt",
  OUT_FOR_DELIVERY: "outForDeliveryAt",
  DELIVERED: "deliveredAt",
  COLLECTED: "collectedAt",
  CANCELLED: "cancelledAt",
};

const CUSTOMER_MESSAGE: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: "The supermarket has confirmed your order and is preparing it.",
  READY_FOR_PICKUP: "Your order is ready. Show your pickup QR code or PIN at the pickup point.",
  COLLECTED: "Thanks for shopping with Sub Net! Your receipt is on the order page.",
  OUT_FOR_DELIVERY: "Your rider has picked up your order and is on the way. Track them on the order page and give them your PIN when they arrive.",
  DELIVERED: "Your order has been delivered. Thanks for shopping with Sub Net!",
};

const DELIVERY_CUSTOMER_MESSAGE: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: "The supermarket has confirmed your order. We're finding a rider.",
  READY_FOR_PICKUP: "Your order is packed and waiting for the rider.",
};

/**
 * Moves an order to a new status. The order is locked and its status
 * re-checked inside the transaction so two staff can't act on it at once.
 * Cancelling a paid online order refunds what was paid.
 */
export async function changeOrderStatus(opts: { orderId: string; actor: OrderActor; actorId: string | null; to: OrderStatus; reason?: string | null }) {
  const { orderId, actor, actorId, to } = opts;
  if (to === "CANCELLED" && actor !== "CUSTOMER" && !opts.reason) throw new OrderError("Give the customer a reason for cancelling");

  const order = await db.$transaction(async (tx) => {
    // Row lock so concurrent changes run one after the other.
    await tx.$queryRaw`SELECT 1 FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true, supermarket: { select: { name: true } } } });
    if (!canTransition(actor, order.status, to, order.fulfilment)) {
      throw new OrderError(`This order is already ${ORDER_STATUS_LABEL[order.status].toLowerCase()}`);
    }
    if (to === "CANCELLED") {
      for (const item of order.items) if (item.stockReserved) await releaseStock(tx, item.inventoryId, item.quantity);
    }
    const stamp = TIMESTAMP[to];
    const paidNow = to === "COLLECTED" && order.paymentMethod === "PAY_AT_STORE";
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: to,
        ...(stamp ? { [stamp]: new Date() } : {}),
        ...(paidNow ? { paymentStatus: "PAID" as const, paidAt: new Date() } : {}),
        // Only store and system cancellations record a reason; the customer knows why they cancelled.
        ...(to === "CANCELLED" ? { cancelReason: actor === "CUSTOMER" ? null : opts.reason } : {}),
      },
    });
    const note =
      to === "CANCELLED"
        ? actor === "CUSTOMER"
          ? "Cancelled by the customer"
          : actor === "SYSTEM"
            ? opts.reason
            : `Cancelled by the supermarket: ${opts.reason}`
        : to === "COLLECTED"
          ? paidNow
            ? "Pickup code verified · paid at the store · collected"
            : "Pickup code verified · collected"
          : to === "OUT_FOR_DELIVERY"
            ? "Rider picked up the order"
            : to === "DELIVERED"
              ? "Delivered · customer PIN verified"
              : to === "READY_FOR_PICKUP" && order.fulfilment === "DELIVERY"
                ? "Packed and waiting for the rider"
                : null;
    await tx.orderEvent.create({ data: { orderId, status: to, actorId, note } });

    if (to === "CANCELLED") {
      // A rider who had accepted the delivery loses the job, and its earning.
      const assignment = await tx.deliveryAssignment.findUnique({ where: { orderId }, include: { rider: true } });
      if (assignment && assignment.status !== "CANCELLED") {
        await tx.deliveryAssignment.update({ where: { id: assignment.id }, data: { status: "CANCELLED", earningStatus: "VOID", cancelledAt: new Date() } });
        await tx.notification.create({ data: { userId: assignment.rider.userId, title: `Delivery ${order.number} cancelled`, body: "The order was cancelled, so you don't need to collect it." } });
      }
    }
    if (to === "CONFIRMED" && order.fulfilment === "DELIVERY") await notifyRidersOfJob(tx, order);
    // Keep the rider's job in step with the order, in the same transaction.
    if (to === "OUT_FOR_DELIVERY") {
      await tx.deliveryAssignment.update({ where: { orderId }, data: { status: "PICKED_UP", pickedUpAt: new Date() } });
    }
    if (to === "DELIVERED") {
      // Earnings become payable only once the delivery is completed (PRD §16).
      await tx.deliveryAssignment.update({ where: { orderId }, data: { status: "DELIVERED", deliveredAt: new Date(), earningStatus: "ELIGIBLE" } });
    }

    if (actor === "STORE" || actor === "RIDER") {
      const message = (order.fulfilment === "DELIVERY" && DELIVERY_CUSTOMER_MESSAGE[to]) || CUSTOMER_MESSAGE[to];
      const body = to === "CANCELLED" ? `${order.supermarket.name} cancelled your order. Reason: ${opts.reason}` : message;
      if (body) await tx.notification.create({ data: { userId: order.customerId, title: `Order ${order.number}: ${ORDER_STATUS_LABEL[to].toLowerCase()}`, body } });
    } else if (actor === "CUSTOMER" && order.status !== "AWAITING_PAYMENT") {
      await notifyStoreStaff(tx, order.supermarketId, `Order ${order.number} cancelled`, "The customer cancelled this order.");
    } else if (actor === "SYSTEM" && to === "CANCELLED") {
      await tx.notification.create({ data: { userId: order.customerId, title: `Order ${order.number} cancelled`, body: opts.reason ?? "Your order was cancelled." } });
    }
    return order;
  });

  if (to === "CANCELLED" && order.paymentStatus === "PAID" && order.paymentMethod === "ONLINE") {
    await refundOrderBalance(orderId, `Order ${order.number} cancelled`);
  }
  return order;
}

/** Tells online, approved riders whose vehicle is big enough about a new delivery job. */
async function notifyRidersOfJob(tx: Tx, order: { number: string; requiredVehicle: VehicleType | null }) {
  const required = order.requiredVehicle ?? "MOTORCYCLE";
  const riders = await tx.rider.findMany({
    where: { status: "APPROVED", isOnline: true, user: { status: "ACTIVE" } },
    select: { userId: true, vehicleType: true },
  });
  const eligible = riders.filter((r) => canCarry(r.vehicleType, required));
  if (eligible.length) {
    await tx.notification.createMany({
      data: eligible.map((r) => ({
        userId: r.userId,
        title: `New delivery ${order.number}`,
        body: `${VEHICLE_NAME[required]} or larger. Open your dashboard to accept it.`,
      })),
    });
  }
}

/**
 * Lets the store supply fewer of an item than requested (e.g. it ran out)
 * before confirming. Reserved stock is returned, totals and commission are
 * recalculated, and a paid online order is refunded the difference.
 */
export async function adjustOrderItem(opts: { supermarketId: string; orderItemId: string; quantity: number; actorId: string }) {
  const result = await db.$transaction(async (tx) => {
    const item = await tx.orderItem.findUnique({ where: { id: opts.orderItemId }, include: { order: true } });
    if (!item || item.order.supermarketId !== opts.supermarketId) throw new OrderError("Item not found");
    await tx.$queryRaw`SELECT 1 FROM "Order" WHERE "id" = ${item.orderId} FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({ where: { id: item.orderId }, include: { items: true } });
    if (!canAdjustItems(order.status)) throw new OrderError("Items can only be changed before the order is confirmed");
    if (!Number.isInteger(opts.quantity) || opts.quantity < 0 || opts.quantity > item.requestedQuantity) {
      throw new OrderError(`Choose between 0 and ${item.requestedQuantity}`);
    }
    if (opts.quantity === item.quantity) return { order, refundKobo: 0 };
    const remaining = order.items.reduce((n, i) => n + (i.id === item.id ? opts.quantity : i.quantity), 0);
    if (remaining === 0) throw new OrderError("Every item would be removed. Cancel the order instead.");

    if (item.stockReserved && opts.quantity < item.quantity) await releaseStock(tx, item.inventoryId, item.quantity - opts.quantity);
    if (item.stockReserved && opts.quantity > item.quantity && item.inventoryId) {
      try {
        await reserveStock(tx, item.inventoryId, opts.quantity - item.quantity, item.name);
      } catch (err) {
        if (err instanceof StockError) throw new OrderError(err.message);
        throw err;
      }
    }
    await tx.orderItem.update({ where: { id: item.id }, data: { quantity: opts.quantity, lineTotalKobo: item.unitPriceKobo * opts.quantity } });
    const items = order.items.map((i) => (i.id === item.id ? { ...i, quantity: opts.quantity } : i));
    const totals = orderTotals(items, order.deliveryFeeKobo);
    await tx.order.update({
      where: { id: order.id },
      data: { ...totals, commissionKobo: commissionOn(totals.subtotalKobo, order.commissionPercent) },
    });
    const note = opts.quantity === 0 ? `Removed ${item.name} (unavailable)` : `${item.name}: ${item.quantity} → ${opts.quantity}`;
    await tx.orderEvent.create({ data: { orderId: order.id, status: order.status, actorId: opts.actorId, note } });
    const refundKobo = order.paymentStatus === "PAID" && order.paymentMethod === "ONLINE" ? Math.max(0, order.totalKobo - totals.totalKobo) : 0;
    await tx.notification.create({
      data: {
        userId: order.customerId,
        title: `Order ${order.number} updated`,
        body: `The supermarket changed your order: ${note}.${refundKobo ? " The difference is being refunded to you." : ""} Your new total is on the order page.`,
      },
    });
    return { order, refundKobo };
  });
  if (result.refundKobo > 0) await refundOrderBalance(result.order.id, `Item change on order ${result.order.number}`, result.refundKobo);
  return result.order;
}
