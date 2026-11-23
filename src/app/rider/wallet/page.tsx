import type { Metadata } from "next";
import { ArrowDownLeft, ArrowUpRight, Landmark, Lock } from "lucide-react";
import { db } from "@/lib/db";
import { requireRider } from "@/lib/riders";
import { cashLimitKobo } from "@/lib/rider-wallet";
import { monnifyConfigured } from "@/lib/payments/monnify";
import { formatNaira } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { BankDetailsForm } from "@/components/forms/bank-forms";
import { GetAccountNumberButton } from "@/components/forms/wallet-forms";
import { Card, EmptyState, Notice, Page, PageTitle, SectionTitle, StatTile, cx } from "@/components/ui";

export const metadata: Metadata = { title: "Cash wallet" };

export default async function RiderWalletPage() {
  const { rider } = await requireRider();
  const [entries, limit] = await Promise.all([
    db.riderWalletEntry.findMany({ where: { riderId: rider.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    cashLimitKobo(),
  ]);
  const owed = Math.max(0, -rider.walletBalanceKobo);
  const room = Math.max(0, limit - owed);

  return (
    <Page className="max-w-3xl">
      <PageTitle
        eyebrow="Rider"
        title="Cash wallet"
        subtitle="Cash you collect on delivery belongs to SubNet and the supermarket. Pay it into your SubNet account; it's credited automatically."
      />
      {rider.cashBlockedAt && (
        <Notice tone="red" title="Account paused">
          You&apos;re holding {formatNaira(owed)} in collected cash, over the {formatNaira(limit)} limit. Transfer at least {formatNaira(owed - limit + 100)} to
          your account below to take deliveries again.
        </Notice>
      )}
      <div className="grid grid-cols-2 gap-2">
        <StatTile label="Cash you owe" value={formatNaira(owed)} tone={owed ? (rider.cashBlockedAt ? "red" : "yellow") : "green"} />
        <StatTile label="You can still collect" value={formatNaira(room)} hint={`Limit ${formatNaira(limit)}`} />
      </div>

      <Card className="space-y-3">
        <SectionTitle>Pay in your cash</SectionTitle>
        {rider.virtualAccountNumber ? (
          <div className="rounded-2xl bg-brand-900 p-4 text-white">
            <p className="text-xs font-bold text-accent-400 uppercase">Your SubNet account</p>
            <p className="font-mono text-3xl font-black tracking-wider">{rider.virtualAccountNumber}</p>
            <p className="text-sm text-brand-100">
              {rider.virtualAccountBank} · {rider.virtualAccountName}
            </p>
            <p className="mt-2 text-xs text-brand-200">Transfer from any bank app. Your wallet updates within a minute.</p>
          </div>
        ) : monnifyConfigured() ? (
          <>
            <p className="text-sm text-gray-600">Get a personal account number to transfer collected cash into. It&apos;s yours to keep.</p>
            <GetAccountNumberButton />
          </>
        ) : (
          <p className="flex items-center gap-2 text-sm text-gray-600">
            <Landmark className="h-4 w-4" aria-hidden /> Pay cash in at the SubNet office; an admin records it here.
          </p>
        )}
      </Card>

      <Card className="space-y-3">
        <SectionTitle>History</SectionTitle>
        {entries.length === 0 ? (
          <EmptyState title="No cash yet">Cash-on-delivery orders you complete will show here.</EmptyState>
        ) : (
          <ul className="divide-y divide-gray-100">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
                {e.amountKobo < 0 ? <ArrowUpRight className="h-4 w-4 text-amber-600" aria-hidden /> : <ArrowDownLeft className="h-4 w-4 text-brand-700" aria-hidden />}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{e.note ?? e.type}</p>
                  <p className="text-xs text-gray-500">{formatDateTime(e.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className={cx("font-bold tabular-nums", e.amountKobo < 0 ? "text-amber-700" : "text-brand-700")}>
                    {e.amountKobo < 0 ? "−" : "+"}
                    {formatNaira(Math.abs(e.amountKobo))}
                  </p>
                  <p className="text-[11px] text-gray-500">owed {formatNaira(Math.max(0, -e.balanceKobo))}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-3">
        <SectionTitle>Your bank account for earnings</SectionTitle>
        <p className="flex items-center gap-1.5 text-sm text-gray-600">
          <Lock className="h-4 w-4" aria-hidden /> Where SubNet pays your delivery earnings.
        </p>
        <BankDetailsForm who="rider" bank={rider} />
      </Card>
    </Page>
  );
}
