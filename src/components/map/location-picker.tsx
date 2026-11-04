"use client";

import { useEffect, useRef, useState } from "react";
import { LocateFixed } from "lucide-react";
import { buttonClass } from "../ui";
import { LeafletMap, MAP_COLORS } from "./index";

/** Pin a location by tapping the map or using the phone's GPS. */
export function LocationPicker({
  error,
  defaults,
  label = "Pin the exact spot",
  markerLabel = "Deliver here",
  hint = "Tap the map where the rider should come, or use your location.",
  autoLocate = false,
}: {
  error?: string;
  defaults?: { lat: number; lng: number };
  label?: string;
  markerLabel?: string;
  hint?: string;
  /** Ask for the phone's location as soon as the picker opens (when nothing is pinned yet). */
  autoLocate?: boolean;
}) {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(defaults ?? null);
  const [status, setStatus] = useState<string | null>(null);

  const started = useRef(false);
  useEffect(() => {
    if (autoLocate && !defaults && !started.current) {
      started.current = true;
      locate();
    }
    // Runs once when the picker opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function locate() {
    if (!navigator.geolocation) return setStatus("Location isn't available in this browser");
    setStatus("Getting your location…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setStatus("Location set. Tap the map to adjust it.");
      },
      () => setStatus("Couldn't get your location. Tap the map instead."),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-2">
        <span className="text-sm font-semibold text-gray-800">{label}</span>
        <button type="button" onClick={locate} className={buttonClass("secondary", "sm")}>
          <LocateFixed className="h-4 w-4" aria-hidden /> Use my location
        </button>
      </div>
      <div className="h-64 overflow-hidden rounded-xl border border-gray-300">
        <LeafletMap
          className="h-full w-full"
          points={pos ? [{ ...pos, label: markerLabel, color: MAP_COLORS.customer }] : []}
          onPick={(lat, lng) => {
            setPos({ lat, lng });
            setStatus("Pin placed.");
          }}
        />
      </div>
      <input type="hidden" name="latitude" value={pos?.lat ?? ""} />
      <input type="hidden" name="longitude" value={pos?.lng ?? ""} />
      {error && !pos ? (
        <p className="text-xs font-medium text-red-600">{error}</p>
      ) : (
        <p className="text-xs text-gray-500">{status ?? hint}</p>
      )}
    </div>
  );
}
