// Order lifecycle for Reserve & Pick Up. Online orders start as
// AWAITING_PAYMENT and only reach the store once paid; pay-at-store orders
// start as PLACED.
import type { OrderStatus } from "@/generated/prisma/enums";

export type OrderActor = "CUSTOMER" | "STORE" | "SYSTEM";

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
};

export function canTransition(actor: OrderActor, from: OrderStatus, to: OrderStatus) {
  return TRANSITIONS[actor][from]?.includes(to) ?? false;
}

/** Stores may change quantities only before confirming. */
export function canAdjustItems(status: OrderStatus) {
  return status === "PLACED";
}

export function isOpen(status: OrderStatus) {
  return status !== "COLLECTED" && status !== "CANCELLED";
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: "Awaiting payment",
  PLACED: "Placed",
  CONFIRMED: "Being prepared",
  READY_FOR_PICKUP: "Ready for pickup",
  COLLECTED: "Collected",
  CANCELLED: "Cancelled",
};

/** What the customer sees about where their order is. */
export const ORDER_STATUS_HELP: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: "Complete payment to send your order to the supermarket. Unpaid orders are cancelled after 30 minutes.",
  PLACED: "Waiting for the supermarket to confirm your order.",
  CONFIRMED: "The supermarket is picking and bagging your items.",
  READY_FOR_PICKUP: "Your order is bagged and waiting. Show your pickup QR code or PIN at the pickup point.",
  COLLECTED: "You collected this order.",
  CANCELLED: "This order was cancelled.",
};

export const CUSTOMER_STEPS: OrderStatus[] = ["PLACED", "CONFIRMED", "READY_FOR_PICKUP", "COLLECTED"];

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
export const ACTIVE_STATUSES: OrderStatus[] = ["AWAITING_PAYMENT", "PLACED", "CONFIRMED", "READY_FOR_PICKUP"];

/** Commission on product sales (delivery fees excluded), PRD §18. */
export function commissionOn(subtotalKobo: number, percent: number) {
  return Math.round((subtotalKobo * percent) / 100);
}
