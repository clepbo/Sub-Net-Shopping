"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window` when imported, so it only loads in the browser.
export const LeafletMap = dynamic(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center bg-gray-100 text-sm text-gray-500">Loading map…</div>,
});

export const MAP_COLORS = { store: "#15803d", customer: "#dc2626", rider: "#2563eb" } as const;
