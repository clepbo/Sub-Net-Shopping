"use client";

import Link from "next/link";
import { useState } from "react";
import { BadgeCheck, LocateFixed, MapPin } from "lucide-react";
import { distanceKm } from "@/lib/geo";
import { StoreLogo } from "./store-logo";
import { buttonClass } from "./ui";

export type StoreCardData = {
  id: string;
  name: string;
  area: string | null;
  address: string;
  logoUrl: string | null;
  lat: number | null;
  lng: number | null;
  /** Server-rendered status badges. */
  badges: React.ReactNode;
};

/** Store cards, optionally sorted by distance from the shopper. */
export function StoreList({ stores }: { stores: StoreCardData[] }) {
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function locate() {
    if (!navigator.geolocation) {
      setError("Location isn't available in this browser");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setError("We couldn't get your location. Check your location permission.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }

  const withDistance = stores.map((s) => ({
    ...s,
    km: here && s.lat !== null && s.lng !== null ? distanceKm(here, { lat: s.lat, lng: s.lng }) : null,
  }));
  if (here) withDistance.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500">{here ? "Sorted by distance from you" : "Sorted by name"}</p>
        <button type="button" onClick={locate} disabled={locating} className={buttonClass("secondary", "sm")}>
          <LocateFixed className="h-4 w-4" aria-hidden />
          {locating ? "Locating…" : here ? "Update location" : "Nearest to me"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <ul className="space-y-3">
        {withDistance.map((s) => (
          <li key={s.id}>
            <Link
              href={`/stores/${s.id}`}
              className="flex gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm transition hover:border-brand-500"
            >
              <StoreLogo name={s.name} url={s.logoUrl} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="leading-tight font-bold text-gray-900">{s.name}</h3>
                  {s.km !== null && <span className="shrink-0 text-xs font-semibold text-gray-500">{s.km.toFixed(1)} km</span>}
                </div>
                <p className="flex items-center gap-1 truncate text-xs text-gray-500">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {s.area ? `${s.area} · ` : ""}
                  {s.address}
                </p>
                <p className="flex items-center gap-1 text-[11px] font-bold text-brand-700">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Verified supermarket
                </p>
                {s.badges}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
