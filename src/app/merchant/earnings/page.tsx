import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireMerchantStore } from "@/lib/supermarkets";
import { unsettledSummary } from "@/lib/settlements";
import { formatNaira } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import Link from "next/link";
import { Badge, Card, EmptyState, Notice, Page, PageTitle, SectionTitle, StatTile } from "@/components/ui";

export const metadata: Metadata = { title: "Earnings" };

export default async function EarningsPage() {
  const { store } = await requireMerchantStore({ managerOnly: true });
  const [summary, settlements] = await Promise.all([
    unsettledSummary(store.id),
    db.settlement.findMany({ where: { supermarketId: store.id }, orderBy: { createdAt: "desc" }, take: 24 }),
  ]);
  return (
    <Page>
      <PageTitle
        eyebrow="Merchant"
        title="Earnings"
        subtitle="Your wallet: completed orders not yet paid out. You receive your shelf price for every item sold online or by cash on delivery; SubNet's share of pay-at-store sales is deducted."
      />
      {!store.bankAccountNumber ? (
        <Notice tone="yellow" title="Add your bank account to get paid">
          <Link href="/merchant/profile#bank" className="font-bold underline">
            Add bank details
          </Link>{" "}
          so tonight&apos;s payout can be sent.
        </Notice>
      ) : (
        <p className="rounded-2xl bg-brand-50 p-3 text-sm text-brand-900">
          Paid automatically every night at <span className="font-bold">10 PM</span> to {store.bankName} ••••{store.bankAccountNumber.slice(-4)} ({store.bankAccountName}).
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatTile label="Sales" value={formatNaira(summary.grossKobo)} hint={`${summary.orderCount} orders`} />
        <StatTile label="SubNet's share" value={formatNaira(summary.commissionKobo)} tone="yellow" />
        <StatTile label="Online & cash, your share" value={formatNaira(summary.onlineNetKobo)} tone="blue" />
        <StatTile
          label={summary.payableKobo >= 0 ? "Pending: paid at 10 PM" : "You owe SubNet"}
          value={formatNaira(Math.abs(summary.payableKobo))}
          tone={summary.payableKobo >= 0 ? "green" : "red"}
        />
      </div>
      <Card>
        <SectionTitle>Settlement statements</SectionTitle>
        {settlements.length === 0 ? (
          <EmptyState title="No statements yet">SubNet creates statements for collected orders and pays them out by bank transfer.</EmptyState>
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
                      <Badge tone={s.status === "PAID" ? "green" : s.status === "FAILED" ? "red" : "yellow"}>
                        {s.status === "PAID" ? `Paid · ${s.transferReference}` : s.status === "PROCESSING" ? "Transfer sent" : s.status === "FAILED" ? "Transfer failed, retrying" : "Pending"}
                      </Badge>
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
