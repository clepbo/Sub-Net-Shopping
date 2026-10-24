"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";

export type MapPoint = { lat: number; lng: number; label: string; color: string };

/** Benin City centre, used when there's nothing to show yet. */
export const BENIN_CITY = { lat: 6.335, lng: 5.6037 };

function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join("|");
  useEffect(() => {
    if (points.length === 1) map.setView([points[0].lat, points[0].lng], 15);
    else if (points.length > 1) map.fitBounds(points.map((p) => [p.lat, p.lng]) as LatLngBoundsExpression, { padding: [40, 40] });
    // Refit only when the set of points changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

/** OpenStreetMap with labelled circle markers; optionally pick a point by tapping. */
export default function LeafletMap({ points, onPick, className }: { points: MapPoint[]; onPick?: (lat: number, lng: number) => void; className?: string }) {
  const center = points[0] ?? { ...BENIN_CITY };
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={13} scrollWheelZoom={false} className={className} style={{ zIndex: 0 }}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {points.map((p) => (
        <CircleMarker key={p.label} center={[p.lat, p.lng]} radius={9} pathOptions={{ color: "#fff", weight: 3, fillColor: p.color, fillOpacity: 1 }}>
          <Tooltip permanent direction="top" offset={[0, -8]}>
            {p.label}
          </Tooltip>
        </CircleMarker>
      ))}
      <FitBounds points={points} />
      {onPick && <ClickHandler onPick={onPick} />}
    </MapContainer>
  );
}
