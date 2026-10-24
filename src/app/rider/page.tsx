import Link from "next/link";
import { ArrowRight, MapPin, Package } from "lucide-react";
import { requireRider, VEHICLE_LABEL } from "@/lib/riders";
import { activeAssignment, availableDeliveries } from "@/lib/deliveries";
import { riderEarningsSummary } from "@/lib/rider-payouts";
import { VEHICLE_NAME } from "@/lib/delivery-rules";
import { formatNaira } from "@/lib/money";
import { ApprovalBadge, ApprovalNotice } from "@/components/approval";
import { AcceptButton, LocationSharer } from "@/components/forms/rider-delivery-forms";
import { OnlineToggle } from "@/components/forms/rider-forms";
import { Card, EmptyState, LinkButton, Page, SectionTitle, StatTile } from "@/components/ui";

export default async function RiderDashboard() {
  const { user, rider } = await requireRider();
  const working = rider.status === "APPROVED" && rider.isOnline;
  const [active, jobs, earnings] = await Promise.all([
    activeAssignment(rider.id),
    working ? availableDeliveries(rider) : Promise.resolve([]),
    riderEarningsSummary(rider.id),
  ]);

  return (
    <Page>
      <div className="flex items-center justify-between rounded-2xl bg-brand-900 p-4 text-white shadow-md">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-wider text-accent-400 uppercase">Sub Net rider</p>
          <h1 className="truncate text-lg font-black">
            {user.firstName} {user.lastName}
          </h1>
          <p className="text-xs text-brand-200">
            {VEHICLE_LABEL[rider.vehicleType]} · {rider.plateNumber}
          </p>
        </div>
        <ApprovalBadge status={rider.status} />
      </div>

      <ApprovalNotice status={rider.status} reason={rider.statusReason} kind="rider" />

      <Card className="space-y-2">
        <OnlineToggle online={rider.isOnline} canGoOnline={rider.status === "APPROVED"} />
        {working && <LocationSharer />}
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Payable" value={formatNaira(earnings.eligibleKobo)} tone="green" />
        <StatTile label="In progress" value={formatNaira(earnings.pendingKobo)} tone="yellow" />
        <StatTile label="Delivered" value={earnings.completed} />
      </div>

      {active && (
        <Link href={`/rider/deliveries/${active.id}`} className="flex items-center justify-between gap-3 rounded-2xl bg-accent-400 p-4 text-brand-950">
          <span>
            <span className="block text-xs font-bold uppercase">Current delivery</span>
            <span className="block font-mono text-lg font-black">{active.order.number}</span>
            <span className="text-sm">{active.status === "ASSIGNED" ? `Collect from ${active.order.supermarket.name}` : `Deliver to ${active.order.deliveryAddress}`}</span>
          </span>
          <ArrowRight className="h-6 w-6 shrink-0" aria-hidden />
        </Link>
      )}

      {working && !active && (
        <section>
          <SectionTitle>Deliveries you can take</SectionTitle>
          {jobs.length === 0 ? (
            <EmptyState icon={<Package className="h-8 w-8" />} title="No deliveries waiting">
              We&apos;ll notify you when a supermarket confirms a delivery your vehicle can carry.
            </EmptyState>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {jobs.map(({ order: o, earningKobo, toStoreKm }) => (
                <li key={o.id}>
                  <Card className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold">{o.supermarket.name}</p>
                        <p className="flex items-center gap-1 text-xs text-gray-500">
                          <MapPin className="h-3.5 w-3.5" aria-hidden /> {o.supermarket.area ?? o.supermarket.address}
                          {toStoreKm !== null && ` · ${toStoreKm} km from you`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-brand-800">{formatNaira(earningKobo)}</p>
                        <p className="text-[11px] text-gray-500">you earn</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">
                      {o.deliveryDistanceKm} km to the customer · {o._count.items} item{o._count.items === 1 ? "" : "s"} · {VEHICLE_NAME[o.requiredVehicle ?? "MOTORCYCLE"]}
                      {o.status === "READY_FOR_PICKUP" ? " · packed and ready" : " · being packed"}
                    </p>
                    <AcceptButton orderId={o.id} />
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="flex gap-2">
        <LinkButton href="/rider/earnings" variant="secondary" size="sm">
          Earnings &amp; payouts
        </LinkButton>
        <LinkButton href="/rider/vehicle" variant="secondary" size="sm">
          Vehicle details
        </LinkButton>
      </div>
    </Page>
  );
}
