import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Navigation, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { requireRider } from "@/lib/riders";
import { directionsUrl } from "@/lib/geo";
import { formatNaira } from "@/lib/money";
import { formatNigerianPhone } from "@/lib/phone";
import { DeliveredForm, HandBackButton, LocationSharer, PickedUpButton } from "@/components/forms/rider-delivery-forms";
import { LeafletMap, MAP_COLORS } from "@/components/map";
import { Badge, Card, Notice, Page, SectionTitle, buttonClass, cx } from "@/components/ui";

export const metadata: Metadata = { title: "Delivery" };

export default async function RiderDeliveryPage({ params }: { params: Promise<{ id: string }> }) {
  const { rider } = await requireRider();
  const a = await db.deliveryAssignment.findFirst({
    where: { id: (await params).id, riderId: rider.id },
    include: { order: { include: { supermarket: true, items: true, customer: { select: { firstName: true, lastName: true } } } } },
  });
  if (!a) notFound();
  const o = a.order;
  const s = o.supermarket;
  const toStore = a.status === "ASSIGNED";
  const done = a.status === "DELIVERED" || a.status === "CANCELLED";
  const itemCount = o.items.reduce((n, i) => n + i.quantity, 0);
  const points = [
    ...(s.latitude !== null && s.longitude !== null ? [{ lat: s.latitude, lng: s.longitude, label: "Store", color: MAP_COLORS.store }] : []),
    ...(o.deliveryLat !== null && o.deliveryLng !== null ? [{ lat: o.deliveryLat, lng: o.deliveryLng, label: "Customer", color: MAP_COLORS.customer }] : []),
    ...(rider.lastLat !== null && rider.lastLng !== null ? [{ lat: rider.lastLat, lng: rider.lastLng, label: "You", color: MAP_COLORS.rider }] : []),
  ];
  const nav = toStore ? (s.latitude !== null && s.longitude !== null ? directionsUrl(s.latitude, s.longitude) : null) : o.deliveryLat !== null && o.deliveryLng !== null ? directionsUrl(o.deliveryLat, o.deliveryLng) : null;

  return (
    <Page className="max-w-3xl">
      <Link href="/rider" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Dashboard
      </Link>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-wider text-gray-500 uppercase">Delivery</p>
          <h1 className="font-mono text-2xl font-black">{o.number}</h1>
        </div>
        <div className="text-right">
          <p className="text-xl font-black text-brand-800">{formatNaira(a.riderEarningKobo)}</p>
          <p className="text-xs text-gray-500">
            fee {formatNaira(a.deliveryFeeKobo)} − {a.riderCommissionPercent}% commission
          </p>
        </div>
      </div>

      {a.status === "CANCELLED" && <Notice tone="red" title="This delivery was cancelled" />}
      {a.status === "DELIVERED" && <Notice tone="green" title="Delivered">Your earning is payable and will be included in your next payout.</Notice>}

      {!done && (
        <>
          <div className="h-72 overflow-hidden rounded-2xl border border-gray-200">
            <LeafletMap className="h-full w-full" points={points} />
          </div>
          <LocationSharer />
        </>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className={cx("space-y-2", toStore && !done && "border-brand-500 ring-1 ring-brand-500")}>
          <div className="flex items-center justify-between">
            <SectionTitle>1. Collect from</SectionTitle>
            {!toStore && <Badge tone="green">Picked up</Badge>}
          </div>
          <p className="font-bold">{s.name}</p>
          <p className="text-sm text-gray-600">{s.address}</p>
          <a href={`tel:${s.phone}`} className="inline-flex items-center gap-1 text-sm text-brand-800 underline">
            <Phone className="h-3.5 w-3.5" aria-hidden /> {formatNigerianPhone(s.phone)}
          </a>
          <p className="text-sm text-gray-600">
            {itemCount} item{itemCount === 1 ? "" : "s"} · order {o.number}
          </p>
        </Card>
        <Card className={cx("space-y-2", !toStore && !done && "border-brand-500 ring-1 ring-brand-500")}>
          <SectionTitle>2. Deliver to</SectionTitle>
          <p className="font-bold">
            {o.customer.firstName} {o.customer.lastName}
          </p>
          <p className="text-sm text-gray-600">
            {o.deliveryAddress}
            {o.deliveryLandmark && <span className="block text-gray-500">{o.deliveryLandmark}</span>}
          </p>
          {o.deliveryPhone && (
            <a href={`tel:${o.deliveryPhone}`} className="inline-flex items-center gap-1 text-sm text-brand-800 underline">
              <Phone className="h-3.5 w-3.5" aria-hidden /> {formatNigerianPhone(o.deliveryPhone)}
            </a>
          )}
        </Card>
      </div>

      {!done && (
        <Card className="space-y-3">
          {nav && (
            <a href={nav} target="_blank" rel="noopener noreferrer" className={cx(buttonClass("secondary"), "w-full")}>
              <Navigation className="h-4 w-4" aria-hidden /> Navigate to {toStore ? "the store" : "the customer"}
            </a>
          )}
          {toStore ? (
            <>
              {o.status !== "READY_FOR_PICKUP" && <p className="text-sm text-amber-800">The store is still packing this order.</p>}
              <PickedUpButton assignmentId={a.id} />
              <HandBackButton assignmentId={a.id} />
            </>
          ) : (
            <DeliveredForm assignmentId={a.id} />
          )}
        </Card>
      )}
    </Page>
  );
}
