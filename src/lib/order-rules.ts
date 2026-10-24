// Order lifecycle for Reserve & Pick Up. Online orders start as
// AWAITING_PAYMENT and only reach the store once paid; pay-at-store orders
// start as PLACED.
import type { Fulfilment, OrderStatus } from "@/generated/prisma/enums";

export type OrderActor = "CUSTOMER" | "STORE" | "SYSTEM" | "RIDER";

/** Next statuses each side may move an order to. */
const TRANSITIONS: Record<OrderActor, Partial<Record<OrderStatus, OrderStatus[]>>> = {
  CUSTOMER: { AWAITING_PAYMENT: ["CANCELLED"], PLACED: ["CANCELLED"] },
  // Payment confirmation and expiry of unpaid orders.
  SYSTEM: { AWAITING_PAYMENT: ["PLACED", "CANCELLED"] },
  STORE: {
    PLACED: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["READY_FOR_PICKUP", "CANCELLED"],
    READY_FOR_PICKUP: ["COLLECTED", "CANCELLED"],
  },
  // The assigned rider takes a delivery order from the store to the customer.
  RIDER: {
    READY_FOR_PICKUP: ["OUT_FOR_DELIVERY"],
    OUT_FOR_DELIVERY: ["DELIVERED"],
  },
};

const PICKUP_ONLY: OrderStatus[] = ["COLLECTED"];
const DELIVERY_ONLY: OrderStatus[] = ["OUT_FOR_DELIVERY", "DELIVERED"];

export function canTransition(actor: OrderActor, from: OrderStatus, to: OrderStatus, fulfilment: Fulfilment = "PICKUP") {
  if (fulfilment === "PICKUP" && DELIVERY_ONLY.includes(to)) return false;
  if (fulfilment === "DELIVERY" && PICKUP_ONLY.includes(to)) return false;
  return TRANSITIONS[actor][from]?.includes(to) ?? false;
}

/** Stores may change quantities only before confirming. */
export function canAdjustItems(status: OrderStatus) {
  return status === "PLACED";
}

export function isOpen(status: OrderStatus) {
  return status !== "COLLECTED" && status !== "DELIVERED" && status !== "CANCELLED";
}

/** Finished successfully: counts towards earnings and settlement. */
export const COMPLETED_STATUSES: OrderStatus[] = ["COLLECTED", "DELIVERED"];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: "Awaiting payment",
  PLACED: "Placed",
  CONFIRMED: "Being prepared",
  READY_FOR_PICKUP: "Ready for pickup",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  COLLECTED: "Collected",
  CANCELLED: "Cancelled",
};

/** What the customer sees about where their order is. */
export const ORDER_STATUS_HELP: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: "Complete payment to send your order to the supermarket. Unpaid orders are cancelled after 30 minutes.",
  PLACED: "Waiting for the supermarket to confirm your order.",
  CONFIRMED: "The supermarket is picking and bagging your items.",
  READY_FOR_PICKUP: "Your order is bagged and waiting. Show your pickup QR code or PIN at the pickup point.",
  OUT_FOR_DELIVERY: "Your rider has your order and is on the way. Give them your PIN when they arrive.",
  DELIVERED: "Your order was delivered.",
  COLLECTED: "You collected this order.",
  CANCELLED: "This order was cancelled.",
};

/** Labels that depend on how the order reaches the customer. */
export function statusLabel(status: OrderStatus, fulfilment: Fulfilment) {
  if (fulfilment === "DELIVERY" && status === "READY_FOR_PICKUP") return "Waiting for rider";
  return ORDER_STATUS_LABEL[status];
}

export function statusHelp(status: OrderStatus, fulfilment: Fulfilment) {
  if (fulfilment === "DELIVERY" && status === "READY_FOR_PICKUP") return "Your order is packed and waiting for the rider to collect it.";
  if (fulfilment === "DELIVERY" && status === "CONFIRMED") return "The supermarket is packing your order. We're finding a rider.";
  return ORDER_STATUS_HELP[status];
}

export const CUSTOMER_STEPS: OrderStatus[] = ["PLACED", "CONFIRMED", "READY_FOR_PICKUP", "COLLECTED"];
export const DELIVERY_STEPS: OrderStatus[] = ["PLACED", "CONFIRMED", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED"];

export function stepsFor(fulfilment: Fulfilment) {
  return fulfilment === "DELIVERY" ? DELIVERY_STEPS : CUSTOMER_STEPS;
}

/** Unpaid online orders are cancelled, and their stock released, after this long. */
export const PAYMENT_WINDOW_MINUTES = 30;

export const MAX_ITEM_QUANTITY = 99;
export const MAX_CART_LINES = 60;

/** Totals from line items; delivery fees arrive with delivery in Phase 5. */
export function orderTotals(items: { unitPriceKobo: number; quantity: number }[], deliveryFeeKobo = 0) {
  const subtotalKobo = items.reduce((sum, i) => sum + i.unitPriceKobo * i.quantity, 0);
  return { subtotalKobo, deliveryFeeKobo, totalKobo: subtotalKobo + deliveryFeeKobo };
}

/** "SN-48219370" — 8 random digits. */
export function newOrderNumber(random: () => number = Math.random) {
  return `SN-${String(Math.floor(random() * 100_000_000)).padStart(8, "0")}`;
}

/** Statuses during which an order's pickup code must be unique within its store. */
export const ACTIVE_STATUSES: OrderStatus[] = ["AWAITING_PAYMENT", "PLACED", "CONFIRMED", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"];

/** Commission on product sales (delivery fees excluded), PRD §18. */
export function commissionOn(subtotalKobo: number, percent: number) {
  return Math.round((subtotalKobo * percent) / 100);
}
