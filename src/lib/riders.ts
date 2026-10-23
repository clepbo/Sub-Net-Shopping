import "server-only";
import { db } from "./db";
import { requireUser } from "./auth";

export async function requireRider() {
  const user = await requireUser("RIDER");
  const rider = await db.rider.findUniqueOrThrow({ where: { userId: user.id } });
  return { user, rider };
}

export const VEHICLE_LABEL = {
  MOTORCYCLE: "Motorcycle",
  CAR: "Car",
  VAN: "Van",
  BULKY: "Truck / bulky-item vehicle",
} as const;
