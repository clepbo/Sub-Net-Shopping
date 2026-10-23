import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireMerchantStore } from "@/lib/supermarkets";
import { unsettledSummary } from "@/lib/settlements";
import { formatNaira } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { Badge, Card, EmptyState, Page, PageTitle, SectionTitle, StatTile } from "@/components/ui";

export const metadata: Metadata = { title: "Earnings" };

export default async function EarningsPage() {
  const { store } = await requireMerchantStore();
  const [summary, settlements] = await Promise.all([
    unsettledSummary(store.id),
    db.settlement.findMany({ where: { supermarketId: store.id }, orderBy: { createdAt: "desc" }, take: 24 }),
  ]);
  return (
    <Page>
      <PageTitle
        eyebrow="Merchant"
        title="Earnings"
        subtitle="Collected orders not yet settled. Sub Net holds online payments and pays them out minus commission; commission on pay-at-store sales is deducted from the payout."
      />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatTile label="Collected sales" value={formatNaira(summary.grossKobo)} hint={`${summary.orderCount} orders`} />
        <StatTile label="Commission" value={formatNaira(summary.commissionKobo)} tone="yellow" />
        <StatTile label="Online, after commission" value={formatNaira(summary.onlineNetKobo)} tone="blue" />
        <StatTile
          label={summary.payableKobo >= 0 ? "Next payout" : "You owe Sub Net"}
          value={formatNaira(Math.abs(summary.payableKobo))}
          tone={summary.payableKobo >= 0 ? "green" : "red"}
        />
      </div>
      <Card>
        <SectionTitle>Settlement statements</SectionTitle>
        {settlements.length === 0 ? (
          <EmptyState title="No statements yet">Sub Net creates statements for collected orders and pays them out by bank transfer.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs text-gray-500 uppercase">
                <tr>
                  <th className="py-2">Date</th>
                  <th className="py-2 text-right">Orders</th>
                  <th className="py-2 text-right">Sales</th>
                  <th className="py-2 text-right">Commission</th>
                  <th className="py-2 text-right">Payout</th>
                  <th className="py-2 pl-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {settlements.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2">{formatDateTime(s.createdAt)}</td>
                    <td className="py-2 text-right">{s.orderCount}</td>
                    <td className="py-2 text-right tabular-nums">{formatNaira(s.grossKobo)}</td>
                    <td className="py-2 text-right tabular-nums">{formatNaira(s.commissionKobo)}</td>
                    <td className="py-2 text-right font-bold tabular-nums">{s.payableKobo < 0 ? `−${formatNaira(-s.payableKobo)}` : formatNaira(s.payableKobo)}</td>
                    <td className="py-2 pl-3">
                      <Badge tone={s.status === "PAID" ? "green" : "yellow"}>{s.status === "PAID" ? `Paid · ${s.transferReference}` : "Pending"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Page>
  );
}
