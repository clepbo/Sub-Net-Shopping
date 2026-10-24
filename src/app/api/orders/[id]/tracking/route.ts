import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/** Live delivery position for the order's customer (polled by the tracking map). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.status !== "ACTIVE") return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const order = await db.order.findFirst({
    where: { id: (await params).id, customerId: user.id, fulfilment: "DELIVERY" },
    select: { status: true, delivery: { select: { status: true, rider: { select: { lastLat: true, lastLng: true, lastLocationAt: true } } } } },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const r = order.delivery?.rider;
  // Only share the rider's position while they're working on this order.
  const sharing = order.delivery && ["ASSIGNED", "PICKED_UP"].includes(order.delivery.status) && r?.lastLat != null && r.lastLng != null;
  return NextResponse.json(
    { status: order.status, rider: sharing ? { lat: r!.lastLat, lng: r!.lastLng, at: r!.lastLocationAt } : null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
