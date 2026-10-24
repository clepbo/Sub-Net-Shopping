import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { unsettledByStore } from "@/lib/settlements";
import { riderBalances } from "@/lib/rider-payouts";
import { formatNaira } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { CreateRiderPayoutButton, CreateSettlementButton, MarkPaidForm, MarkRiderPayoutPaidForm } from "@/components/forms/finance-forms";
import { Badge, Card, EmptyState, Page, PageTitle, SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Settlements" };

const signed = (kobo: number) => (kobo < 0 ? `−${formatNaira(-kobo)}` : formatNaira(kobo));

export default async function AdminSettlements() {
  await requireUser("ADMIN");
  const [balances, settlements, riders, payouts] = await Promise.all([
    unsettledByStore(),
    db.settlement.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 100, include: { supermarket: { select: { name: true } } } }),
    riderBalances(),
    db.riderPayout.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 100, include: { rider: { include: { user: { select: { firstName: true, lastName: true } } } } } }),
  ]);
  return (
    <Page>
      <PageTitle
        eyebrow="Admin"
        title="Settlements & payouts"
        subtitle="Payable = online sales minus commission, minus commission owed on pay-at-store sales. Negative means the supermarket owes Sub Net."
      />
      <Card>
        <SectionTitle>Waiting to be settled</SectionTitle>
        {balances.length === 0 ? (
          <EmptyState title="Nothing to settle" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs text-gray-500 uppercase">
                <tr>
                  <th className="py-2">Supermarket</th>
                  <th className="py-2 text-right">Orders</th>
                  <th className="py-2 text-right">Sales</th>
                  <th className="py-2 text-right">Commission</th>
                  <th className="py-2 text-right">Payable</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {balances.map((b) => (
                  <tr key={b.supermarket.id}>
                    <td className="py-2 font-semibold">{b.supermarket.name}</td>
                    <td className="py-2 text-right">{b.orderCount}</td>
                    <td className="py-2 text-right tabular-nums">{formatNaira(b.grossKobo)}</td>
                    <td className="py-2 text-right tabular-nums">{formatNaira(b.commissionKobo)}</td>
                    <td className="py-2 text-right font-bold tabular-nums">{signed(b.payableKobo)}</td>
                    <td className="py-2 pl-3 text-right">
                      <CreateSettlementButton supermarketId={b.supermarket.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card>
        <SectionTitle>Statements</SectionTitle>
        {settlements.length === 0 ? (
          <EmptyState title="No statements yet" />
        ) : (
          <ul className="divide-y divide-gray-100">
            {settlements.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-semibold">{s.supermarket.name}</p>
                  <p className="text-xs text-gray-500">
                    {formatDateTime(s.createdAt)} · {s.orderCount} orders · sales {formatNaira(s.grossKobo)} · commission {formatNaira(s.commissionKobo)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-extrabold tabular-nums">{signed(s.payableKobo)}</span>
                  {s.status === "PAID" ? <Badge tone="green">Paid · {s.transferReference}</Badge> : <MarkPaidForm settlementId={s.id} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <SectionTitle>Rider earnings waiting to be paid</SectionTitle>
        {riders.length === 0 ? (
          <EmptyState title="No rider earnings to pay" />
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {riders.map((r) => (
              <li key={r.rider.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <span>
                  <span className="font-semibold">
                    {r.rider.user.firstName} {r.rider.user.lastName}
                  </span>
                  <span className="block text-xs text-gray-500">
                    {r.deliveries} deliveries · fees {formatNaira(r.feesKobo)} · commission {formatNaira(r.commissionKobo)}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-extrabold tabular-nums">{formatNaira(r.amountKobo)}</span>
                  <CreateRiderPayoutButton riderId={r.rider.id} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {payouts.length > 0 && (
        <Card>
          <SectionTitle>Rider payouts</SectionTitle>
          <ul className="divide-y divide-gray-100">
            {payouts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span>
                  <span className="font-semibold">
                    {p.rider.user.firstName} {p.rider.user.lastName}
                  </span>
                  <span className="block text-xs text-gray-500">
                    {formatDateTime(p.createdAt)} · {p.deliveryCount} deliveries
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-extrabold tabular-nums">{formatNaira(p.amountKobo)}</span>
                  {p.status === "PAID" ? <Badge tone="green">Paid · {p.transferReference}</Badge> : <MarkRiderPayoutPaidForm payoutId={p.id} />}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </Page>
  );
}
