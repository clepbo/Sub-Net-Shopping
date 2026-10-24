"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LeafletMap, MAP_COLORS } from "./map";
import type { MapPoint } from "./map/leaflet-map";

type Point = { lat: number; lng: number };

/** Live map of the rider, store and drop-off; refreshes every 10 seconds. */
export function DeliveryTracker({ orderId, store, destination, initialStatus }: { orderId: string; store: Point | null; destination: Point; initialStatus: string }) {
  const router = useRouter();
  const [rider, setRider] = useState<(Point & { at: string }) | null>(null);
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    let stopped = false;
    async function poll() {
      try {
        const res = await fetch(`/api/orders/${orderId}/tracking`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (stopped) return;
        setRider(data.rider);
        if (data.status !== status) {
          setStatus(data.status);
          router.refresh(); // update the rest of the page when the order moves on
        }
      } catch {
        // Try again on the next tick.
      }
    }
    poll();
    const timer = setInterval(poll, 10_000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [orderId, status, router]);

  const points: MapPoint[] = [
    ...(store ? [{ ...store, label: "Store", color: MAP_COLORS.store }] : []),
    { ...destination, label: "You", color: MAP_COLORS.customer },
    ...(rider ? [{ lat: rider.lat, lng: rider.lng, label: "Rider", color: MAP_COLORS.rider }] : []),
  ];
  return (
    <div className="space-y-2">
      <div className="h-72 overflow-hidden rounded-xl border border-gray-200">
        <LeafletMap className="h-full w-full" points={points} />
      </div>
      <p className="text-xs text-gray-500">
        {rider ? `Rider location updated ${new Date(rider.at).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })}` : "The rider's location appears here once they start the delivery."}
      </p>
    </div>
  );
}
