// Delivery pricing and vehicle matching (PRD §14). Pure, so checkout,
// tests and the rider app all agree.
import type { VehicleType } from "@/generated/prisma/enums";
import { distanceKm } from "./geo";

export const VEHICLES: VehicleType[] = ["MOTORCYCLE", "CAR", "VAN", "BULKY"];
const RANK: Record<VehicleType, number> = { MOTORCYCLE: 0, CAR: 1, VAN: 2, BULKY: 3 };
/** Bigger vehicles cost more to run. */
export const VEHICLE_FEE_MULTIPLIER: Record<VehicleType, number> = { MOTORCYCLE: 1, CAR: 1.6, VAN: 2.5, BULKY: 4 };

/** More items than this won't fit on a motorcycle. */
export const MOTORCYCLE_MAX_ITEMS = 25;
/** Straight-line distance × this ≈ road distance in Benin City. */
export const ROAD_FACTOR = 1.3;

export function requiredVehicle(items: { isBulky: boolean; quantity: number }[]): VehicleType {
  if (items.some((i) => i.isBulky && i.quantity > 0)) return "VAN";
  const count = items.reduce((n, i) => n + i.quantity, 0);
  return count > MOTORCYCLE_MAX_ITEMS ? "CAR" : "MOTORCYCLE";
}

/** Whether a rider's vehicle can take a delivery that needs `required`. */
export function canCarry(vehicle: VehicleType, required: VehicleType) {
  return RANK[vehicle] >= RANK[required];
}

export function roadDistanceKm(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  return Math.round(distanceKm(from, to) * ROAD_FACTOR * 10) / 10;
}

export type DeliveryRates = { baseKobo: number; perKmKobo: number; maxKm: number };

export type DeliveryQuote = { ok: true; distanceKm: number; vehicle: VehicleType; feeKobo: number } | { ok: false; reason: string };

/** Fee = (base + per-km × distance) × vehicle multiplier, rounded up to the nearest ₦50. */
export function deliveryQuote(opts: {
  from: { lat: number; lng: number } | null;
  to: { lat: number; lng: number };
  items: { isBulky: boolean; quantity: number }[];
  rates: DeliveryRates;
}): DeliveryQuote {
  if (!opts.from) return { ok: false, reason: "This supermarket hasn't set its location, so it can't deliver yet." };
  const km = roadDistanceKm(opts.from, opts.to);
  if (km > opts.rates.maxKm) return { ok: false, reason: `This address is about ${km} km away. This supermarket delivers up to ${opts.rates.maxKm} km.` };
  const vehicle = requiredVehicle(opts.items);
  const raw = (opts.rates.baseKobo + opts.rates.perKmKobo * km) * VEHICLE_FEE_MULTIPLIER[vehicle];
  const feeKobo = Math.ceil(raw / 5_000) * 5_000;
  return { ok: true, distanceKm: km, vehicle, feeKobo };
}

export const VEHICLE_NAME: Record<VehicleType, string> = { MOTORCYCLE: "Motorcycle", CAR: "Car", VAN: "Van", BULKY: "Truck" };
