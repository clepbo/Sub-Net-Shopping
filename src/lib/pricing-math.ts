// Markup pricing (from "Commission percentages"): stores enter their shelf
// price and receive exactly that; customers see it marked up to cover SubNet's
// commission and the payment gateway's fee, rounded to a clean figure.

/** Rounding step in kobo for a raw price: ₦10 under ₦500, ₦50 under ₦5,000, then ₦100. */
export function roundingStep(rawKobo: number) {
  if (rawKobo < 50_000) return 1_000;
  if (rawKobo < 500_000) return 5_000;
  return 10_000;
}

/** The customer price for a shelf price: marked up, rounded up to the step, never below the shelf price. */
export function customerPrice(shelfKobo: number, markupPercent: number) {
  const raw = shelfKobo * (1 + markupPercent / 100);
  const step = roundingStep(raw);
  // Tiny epsilon so 1120.0000000001 doesn't round up a whole step.
  return Math.max(shelfKobo, Math.ceil(raw / step - 1e-9) * step);
}

/**
 * The exact markup needed for the store to get its shelf price after SubNet's
 * commission and the gateway fee are taken from the customer price
 * (the "fee-on-fee" formula: shelf ÷ (1 − (commission + gateway))).
 */
export function breakEvenMarkupPercent(commissionPercent: number, gatewayPercent: number) {
  return (1 / (1 - (commissionPercent + gatewayPercent) / 100) - 1) * 100;
}

/** Markup for a category: its own, else its parent's, else the platform default. */
export function markupFor(category: { markupPercent: number | null; parent?: { markupPercent: number | null } | null } | null, defaultPercent: number) {
  return category?.markupPercent ?? category?.parent?.markupPercent ?? defaultPercent;
}

/** SubNet's margin on a set of order lines priced by markup. */
export function marginKobo(items: { unitPriceKobo: number; shelfPriceKobo: number | null; quantity: number }[]) {
  return items.reduce((n, i) => n + (i.unitPriceKobo - (i.shelfPriceKobo ?? i.unitPriceKobo)) * i.quantity, 0);
}
