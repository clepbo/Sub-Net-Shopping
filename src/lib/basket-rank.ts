import { distanceKm } from "./geo";

export type BasketOffer = { productId: string; inventoryId: string; priceKobo: number; lowStock: boolean };

export type BasketStore = {
  id: string;
  name: string;
  address: string;
  area: string | null;
  logoUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  offers: BasketOffer[];
};

export type RankedStore = BasketStore & {
  distanceKm: number | null;
  /** Offers for products on the list, one per product (the cheapest). */
  have: BasketOffer[];
  missing: string[];
  complete: boolean;
  totalKobo: number;
};

export type BasketResult = {
  /** Closest store that has every item on the list. */
  bestComplete: RankedStore | null;
  /** Closest store overall, when it isn't the best complete one (it's missing something). */
  closerPartial: RankedStore | null;
  /** All stores with at least one item, complete ones first, then by most items, then nearest. */
  stores: RankedStore[];
  /** Products no store has right now. */
  unavailable: string[];
};

const byDistance = (a: RankedStore, b: RankedStore) => {
  if (a.distanceKm === null && b.distanceKm === null) return a.totalKobo - b.totalKobo;
  if (a.distanceKm === null) return 1;
  if (b.distanceKm === null) return -1;
  return a.distanceKm - b.distanceKm;
};

/**
 * Ranks stores for a shopping list. Without a location, "closest" falls back
 * to cheapest, so the answer is still useful.
 */
export function rankStoresForBasket(productIds: string[], stores: BasketStore[], origin: { lat: number; lng: number } | null): BasketResult {
  const wanted = [...new Set(productIds)];
  const ranked: RankedStore[] = [];
  for (const s of stores) {
    const cheapest = new Map<string, BasketOffer>();
    for (const o of s.offers) {
      if (!wanted.includes(o.productId)) continue;
      const cur = cheapest.get(o.productId);
      if (!cur || o.priceKobo < cur.priceKobo) cheapest.set(o.productId, o);
    }
    if (cheapest.size === 0) continue;
    const have = wanted.filter((id) => cheapest.has(id)).map((id) => cheapest.get(id)!);
    const missing = wanted.filter((id) => !cheapest.has(id));
    ranked.push({
      ...s,
      distanceKm: origin && s.latitude !== null && s.longitude !== null ? distanceKm(origin, { lat: s.latitude, lng: s.longitude }) : null,
      have,
      missing,
      complete: missing.length === 0,
      totalKobo: have.reduce((n, o) => n + o.priceKobo, 0),
    });
  }

  const complete = ranked.filter((r) => r.complete).sort(byDistance);
  const nearest = [...ranked].sort(byDistance)[0] ?? null;
  const bestComplete = complete[0] ?? null;
  const closerPartial =
    nearest && !nearest.complete && (!bestComplete || byDistance(nearest, bestComplete) < 0) ? nearest : null;

  const ordered = [...ranked].sort((a, b) => Number(b.complete) - Number(a.complete) || b.have.length - a.have.length || byDistance(a, b));
  const stocked = new Set(ranked.flatMap((r) => r.have.map((o) => o.productId)));
  return { bestComplete, closerPartial, stores: ordered, unavailable: wanted.filter((id) => !stocked.has(id)) };
}
