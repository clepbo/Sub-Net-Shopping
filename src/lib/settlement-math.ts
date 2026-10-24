// Settlement arithmetic (PRD §18). Sub Net holds online payments and owes
// the store their value minus commission; the store holds pay-at-store
// takings and owes Sub Net the commission on them. Delivery fees belong to
// the rider and Sub Net, so they're left out of the store's figures.

export type SettleableOrder = { totalKobo: number; deliveryFeeKobo?: number; commissionKobo: number; paymentMethod: "ONLINE" | "PAY_AT_STORE" };

export function computeSettlement(orders: SettleableOrder[]) {
  let grossKobo = 0;
  let commissionKobo = 0;
  let onlineNetKobo = 0;
  let storeOwesKobo = 0;
  for (const o of orders) {
    const sales = o.totalKobo - (o.deliveryFeeKobo ?? 0);
    grossKobo += sales;
    commissionKobo += o.commissionKobo;
    if (o.paymentMethod === "ONLINE") onlineNetKobo += sales - o.commissionKobo;
    else storeOwesKobo += o.commissionKobo;
  }
  return { orderCount: orders.length, grossKobo, commissionKobo, onlineNetKobo, storeOwesKobo, payableKobo: onlineNetKobo - storeOwesKobo };
}
