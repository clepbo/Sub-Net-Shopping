import { describe, expect, it } from "vitest";
import { rankStoresForBasket, type BasketStore } from "../basket-rank";

const here = { lat: 6.335, lng: 5.627 };
const store = (id: string, kmNorth: number | null, items: [string, number][]): BasketStore => ({
  id,
  name: id,
  address: "",
  area: null,
  logoUrl: null,
  latitude: kmNorth === null ? null : here.lat + kmNorth / 111,
  longitude: kmNorth === null ? null : here.lng,
  offers: items.map(([productId, priceKobo]) => ({ productId, inventoryId: `${id}-${productId}`, priceKobo, lowStock: false })),
});

const list = ["rice", "oil", "milk", "bread", "eggs"];

describe("rankStoresForBasket", () => {
  it("picks the closest store with all five products, and flags a nearer store that's missing one", () => {
    const stores = [
      store("near", 1, [["rice", 100], ["oil", 100], ["milk", 100], ["bread", 100]]),
      store("mid", 3, list.map((p) => [p, 120] as [string, number])),
      store("far", 8, list.map((p) => [p, 90] as [string, number])),
    ];
    const r = rankStoresForBasket(list, stores, here);
    expect(r.bestComplete?.id).toBe("mid");
    expect(r.closerPartial?.id).toBe("near");
    expect(r.closerPartial?.missing).toEqual(["eggs"]);
    expect(r.stores.map((s) => s.id)).toEqual(["mid", "far", "near"]);
    expect(r.bestComplete?.totalKobo).toBe(600);
    expect(r.unavailable).toEqual([]);
  });

  it("has no partial warning when the closest store is complete", () => {
    const r = rankStoresForBasket(["rice"], [store("a", 1, [["rice", 1]]), store("b", 2, [["oil", 1]])], here);
    expect(r.bestComplete?.id).toBe("a");
    expect(r.closerPartial).toBeNull();
  });

  it("reports products nobody has and when no store is complete", () => {
    const r = rankStoresForBasket(["rice", "gold"], [store("a", 1, [["rice", 1]])], here);
    expect(r.bestComplete).toBeNull();
    expect(r.closerPartial?.id).toBe("a");
    expect(r.unavailable).toEqual(["gold"]);
  });

  it("without a location, falls back to cheapest and puts unmapped stores last", () => {
    const r = rankStoresForBasket(["rice"], [store("dear", 1, [["rice", 500]]), store("cheap", 9, [["rice", 100]])], null);
    expect(r.bestComplete?.id).toBe("cheap");
    const r2 = rankStoresForBasket(["rice"], [store("nomap", null, [["rice", 1]]), store("mapped", 5, [["rice", 9]])], here);
    expect(r2.bestComplete?.id).toBe("mapped");
  });

  it("uses each store's cheapest listing for a product", () => {
    const r = rankStoresForBasket(["rice"], [store("a", 1, [["rice", 300], ["rice", 200]])], here);
    expect(r.bestComplete?.totalKobo).toBe(200);
  });
});
