// Settlement arithmetic (PRD §18). SubNet holds online payments (and cash
// on delivery, which riders remit to SubNet) and owes the store their value
// minus commission; the store holds pay-at-store takings and owes SubNet the
// commission on them. With markup pricing, "commission" is SubNet's margin, so
// the store's share is exactly its shelf prices. Delivery fees belong to
// the rider and SubNet, so they're left out of the store's figures.

export type SettleableOrder = { totalKobo: number; deliveryFeeKobo?: number; commissionKobo: number; paymentMethod: "ONLINE" | "PAY_AT_STORE" | "CASH_ON_DELIVERY" };

export function computeSettlement(orders: SettleableOrder[]) {
  let grossKobo = 0;
  let commissionKobo = 0;
  let onlineNetKobo = 0;
  let storeOwesKobo = 0;
  for (const o of orders) {
    const sales = o.totalKobo - (o.deliveryFeeKobo ?? 0);
    grossKobo += sales;
    commissionKobo += o.commissionKobo;
    if (o.paymentMethod === "PAY_AT_STORE") storeOwesKobo += o.commissionKobo;
    else onlineNetKobo += sales - o.commissionKobo;
  }
  return { orderCount: orders.length, grossKobo, commissionKobo, onlineNetKobo, storeOwesKobo, payableKobo: onlineNetKobo - storeOwesKobo };
}
