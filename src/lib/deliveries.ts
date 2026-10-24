import "server-only";
// Rider delivery flow (PRD §16): accept → pick up at the store → deliver,
// confirmed with the customer's PIN. Earnings become payable only once the
// delivery is completed.
import { db } from "./db";
import { canCarry, roadDistanceKm } from "./delivery-rules";
import { notifyStoreStaff } from "./order-notify";
import { changeOrderStatus, OrderError } from "./orders";
import { commissionOn } from "./order-rules";
import { getSettings } from "./settings";
import { Prisma } from "@/generated/prisma/client";

export type RiderContext = { id: string; userId: string; status: string; isOnline: boolean; vehicleType: import("@/generated/prisma/enums").VehicleType; lastLat: number | null; lastLng: number | null };

function assertCanWork(rider: RiderContext) {
  if (rider.status !== "APPROVED") throw new OrderError("Your rider account isn't approved");
  if (!rider.isOnline) throw new OrderError("Go online to take deliveries");
}

/** The rider's current delivery, if any. Riders carry one order at a time. */
export function activeAssignment(riderId: string) {
  return db.deliveryAssignment.findFirst({
    where: { riderId, status: { in: ["ASSIGNED", "PICKED_UP"] } },
    include: { order: { include: { supermarket: true, items: true, customer: { select: { firstName: true, lastName: true } } } } },
  });
}

/** Paid delivery orders the store has confirmed that no rider has taken and this rider's vehicle can carry. */
export async function availableDeliveries(rider: RiderContext) {
  const orders = await db.order.findMany({
    where: { fulfilment: "DELIVERY", status: { in: ["CONFIRMED", "READY_FOR_PICKUP"] }, paymentStatus: "PAID", delivery: null },
    include: { supermarket: { select: { name: true, address: true, area: true, latitude: true, longitude: true } }, _count: { select: { items: true } } },
    orderBy: { confirmedAt: "asc" },
    take: 50,
  });
  const percent = Number((await getSettings()).riderCommissionPercent) || 0;
  return orders
    .filter((o) => canCarry(rider.vehicleType, o.requiredVehicle ?? "MOTORCYCLE"))
    .map((o) => {
      const s = o.supermarket;
      const toStoreKm =
        rider.lastLat !== null && rider.lastLng !== null && s.latitude !== null && s.longitude !== null
          ? roadDistanceKm({ lat: rider.lastLat, lng: rider.lastLng }, { lat: s.latitude, lng: s.longitude })
          : null;
      return { order: o, earningKobo: o.deliveryFeeKobo - commissionOn(o.deliveryFeeKobo, percent), toStoreKm };
    })
    .sort((a, b) => (a.toStoreKm ?? 99) - (b.toStoreKm ?? 99));
}

/** First rider to accept gets the job (the order has one assignment, enforced by a unique key). */
export async function acceptDelivery(rider: RiderContext, orderId: string) {
  assertCanWork(rider);
  if (await activeAssignment(rider.id)) throw new OrderError("Finish your current delivery first");
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || order.fulfilment !== "DELIVERY" || order.paymentStatus !== "PAID" || !["CONFIRMED", "READY_FOR_PICKUP"].includes(order.status)) {
    throw new OrderError("This delivery is no longer available");
  }
  if (!canCarry(rider.vehicleType, order.requiredVehicle ?? "MOTORCYCLE")) throw new OrderError("This delivery needs a bigger vehicle");
  const percent = Number((await getSettings()).riderCommissionPercent) || 0;
  const commission = commissionOn(order.deliveryFeeKobo, percent);
  try {
    return await db.$transaction(async (tx) => {
      const a = await tx.deliveryAssignment.create({
        data: {
          orderId,
          riderId: rider.id,
          deliveryFeeKobo: order.deliveryFeeKobo,
          riderCommissionPercent: percent,
          riderCommissionKobo: commission,
          riderEarningKobo: order.deliveryFeeKobo - commission,
        },
      });
      const user = await tx.user.findUniqueOrThrow({ where: { id: rider.userId }, select: { firstName: true } });
      await tx.orderEvent.create({ data: { orderId, status: order.status, actorId: rider.userId, note: `Rider ${user.firstName} accepted the delivery` } });
      await tx.notification.create({ data: { userId: order.customerId, title: `Rider assigned to ${order.number}`, body: `${user.firstName} will deliver your order. You can follow them on the order page.` } });
      await notifyStoreStaff(tx, order.supermarketId, `Rider on the way for ${order.number}`, `${user.firstName} accepted the delivery and is heading to your store.`);
      return a;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new OrderError("Another rider just took this delivery");
    throw err;
  }
}

/** Gives the job back before pickup, so another rider can take it. */
export async function releaseDelivery(rider: RiderContext, assignmentId: string) {
  const a = await db.deliveryAssignment.findFirst({ where: { id: assignmentId, riderId: rider.id, status: "ASSIGNED" }, include: { order: true } });
  if (!a) throw new OrderError("You can only hand back a delivery before picking it up");
  await db.$transaction(async (tx) => {
    // Deleting frees the order's single assignment slot for the next rider.
    await tx.deliveryAssignment.delete({ where: { id: a.id } });
    await tx.orderEvent.create({ data: { orderId: a.orderId, status: a.order.status, actorId: rider.userId, note: "Rider handed the delivery back; finding another rider" } });
    await notifyStoreStaff(tx, a.order.supermarketId, `Rider dropped ${a.order.number}`, "We're finding another rider.");
  });
}

/** The rider has the bag: order goes out for delivery. Needs the store to have marked it ready. */
export async function markPickedUp(rider: RiderContext, assignmentId: string) {
  const a = await db.deliveryAssignment.findFirst({ where: { id: assignmentId, riderId: rider.id, status: "ASSIGNED" }, include: { order: true } });
  if (!a) throw new OrderError("Delivery not found");
  if (a.order.status !== "READY_FOR_PICKUP") throw new OrderError("The store hasn't marked this order ready yet. Ask staff to finish packing it.");
  await changeOrderStatus({ orderId: a.orderId, actor: "RIDER", actorId: rider.userId, to: "OUT_FOR_DELIVERY" });
}

/** Completes the delivery once the customer's PIN matches; the earning becomes payable. */
export async function completeDelivery(rider: RiderContext, assignmentId: string, pin: string) {
  const a = await db.deliveryAssignment.findFirst({ where: { id: assignmentId, riderId: rider.id, status: "PICKED_UP" }, include: { order: true } });
  if (!a) throw new OrderError("Delivery not found");
  if (pin.replace(/\s/g, "") !== a.order.pickupPin) throw new OrderError("That PIN doesn't match. Ask the customer to check their order page.");
  await changeOrderStatus({ orderId: a.orderId, actor: "RIDER", actorId: rider.userId, to: "DELIVERED" });
  await db.$transaction((tx) => notifyStoreStaff(tx, a.order.supermarketId, `Order ${a.order.number} delivered`, "The customer confirmed delivery with their PIN."));
}

/** Records the rider's GPS position while they're on a delivery. */
export async function recordLocation(rider: RiderContext, lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
  await db.rider.update({ where: { id: rider.id }, data: { lastLat: lat, lastLng: lng, lastLocationAt: new Date() } });
}
