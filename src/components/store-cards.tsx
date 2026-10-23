import { availabilityOf, type SupermarketWithHours } from "@/lib/supermarkets";
import type { StoreCardData } from "./store-list";
import { ServiceBadges, StoreStateBadge } from "./store-status";

/** Serialises supermarkets for <StoreList>, with status badges rendered on the server. */
export function toStoreCards(stores: SupermarketWithHours[], now: Date): StoreCardData[] {
  return stores.map((s) => {
    const a = availabilityOf(s, now);
    return {
      id: s.id,
      name: s.name,
      area: s.area,
      address: s.address,
      logoUrl: s.logoUrl,
      lat: s.latitude,
      lng: s.longitude,
      badges: (
        <div className="space-y-1.5">
          <StoreStateBadge availability={a} />
          <ServiceBadges availability={a} />
        </div>
      ),
    };
  });
}
