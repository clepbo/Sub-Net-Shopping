import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireRider } from "@/lib/riders";
import { riderEarningsSummary } from "@/lib/rider-payouts";
import { formatNaira } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { Badge, Card, EmptyState, Page, PageTitle, SectionTitle, StatTile, type Tone } from "@/components/ui";

export const metadata: Metadata = { title: "Earnings" };

const EARNING: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: "In progress", tone: "yellow" },
  ELIGIBLE: { label: "Payable", tone: "green" },
  PAID: { label: "Paid", tone: "gray" },
  VOID: { label: "Cancelled", tone: "red" },
};

export default async function RiderEarnings() {
  const { rider } = await requireRider();
  const [summary, deliveries, payouts] = await Promise.all([
    riderEarningsSummary(rider.id),
    db.deliveryAssignment.findMany({ where: { riderId: rider.id }, orderBy: { assignedAt: "desc" }, take: 50, include: { order: { select: { number: true } } } }),
    db.riderPayout.findMany({ where: { riderId: rider.id }, orderBy: { createdAt: "desc" }, take: 24 }),
  ]);
  return (
    <Page>
      <PageTitle eyebrow="Rider" title="Earnings" subtitle="You earn each delivery fee minus Sub Net's commission. Earnings become payable once a delivery is completed." />
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Payable" value={formatNaira(summary.eligibleKobo)} tone="green" />
        <StatTile label="In progress" value={formatNaira(summary.pendingKobo)} tone="yellow" />
        <StatTile label="Paid out" value={formatNaira(summary.paidKobo)} />
      </div>
      <Card>
        <SectionTitle>Deliveries</SectionTitle>
        {deliveries.length === 0 ? (
          <EmptyState title="No deliveries yet" />
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {deliveries.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  <span className="font-mono font-bold">{d.order.number}</span>
                  <span className="block text-xs text-gray-500">
                    {formatDateTime(d.assignedAt)} · fee {formatNaira(d.deliveryFeeKobo)} − {formatNaira(d.riderCommissionKobo)} commission
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-bold tabular-nums">{formatNaira(d.riderEarningKobo)}</span>
                  <Badge tone={EARNING[d.earningStatus].tone}>{EARNING[d.earningStatus].label}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {payouts.length > 0 && (
        <Card>
          <SectionTitle>Payouts</SectionTitle>
          <ul className="divide-y divide-gray-100 text-sm">
            {payouts.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  {formatDateTime(p.createdAt)} · {p.deliveryCount} deliveries
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-bold tabular-nums">{formatNaira(p.amountKobo)}</span>
                  <Badge tone={p.status === "PAID" ? "green" : "yellow"}>{p.status === "PAID" ? `Paid · ${p.transferReference}` : "Processing"}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </Page>
  );
}
