import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { paystackConfigured } from "@/lib/payments/paystack";
import { formatNaira } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { RetryRefundButton } from "@/components/forms/finance-forms";
import { Badge, Card, EmptyState, Notice, Page, PageTitle, SectionTitle, type Tone } from "@/components/ui";

export const metadata: Metadata = { title: "Payments" };

const PAYMENT_TONE: Record<string, Tone> = { SUCCEEDED: "green", INITIALIZED: "yellow", FAILED: "gray" };
const REFUND_TONE: Record<string, Tone> = { PROCESSED: "green", PENDING: "yellow", FAILED: "red" };

export default async function AdminPayments() {
  await requireUser("ADMIN");
  const [failedRefunds, payments, refunds] = await Promise.all([
    db.refund.findMany({ where: { status: "FAILED" }, include: { payment: { include: { order: { select: { number: true } } } } }, orderBy: { createdAt: "desc" } }),
    db.payment.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { order: { select: { number: true, supermarket: { select: { name: true } } } } } }),
    db.refund.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { payment: { include: { order: { select: { number: true } } } } } }),
  ]);
  return (
    <Page>
      <PageTitle eyebrow="Admin" title="Payments" subtitle="Online payments through Paystack, and refunds." />
      {!paystackConfigured() && (
        <Notice tone="yellow" title="Paystack isn't configured">
          Set PAYSTACK_SECRET_KEY to turn on online payment. Until then customers can only pay at the store.
        </Notice>
      )}
      {failedRefunds.length > 0 && (
        <Card className="border-red-300">
          <SectionTitle>Refunds that need attention</SectionTitle>
          <ul className="divide-y divide-gray-100 text-sm">
            {failedRefunds.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-mono font-bold">{r.payment.order.number}</span> · {formatNaira(r.amountKobo)} · {r.reason}
                  <span className="block text-xs text-red-700">{r.error}</span>
                </span>
                <RetryRefundButton refundId={r.id} />
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card>
        <SectionTitle>Recent payments</SectionTitle>
        {payments.length === 0 ? (
          <EmptyState title="No online payments yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs text-gray-500 uppercase">
                <tr>
                  <th className="py-2">Reference</th>
                  <th className="py-2">Supermarket</th>
                  <th className="py-2 text-right">Amount</th>
                  <th className="py-2 pl-3">Status</th>
                  <th className="py-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 font-mono text-xs">{p.reference}</td>
                    <td className="py-2">{p.order.supermarket.name}</td>
                    <td className="py-2 text-right tabular-nums">{formatNaira(p.amountKobo)}</td>
                    <td className="py-2 pl-3">
                      <Badge tone={PAYMENT_TONE[p.status]}>{p.status.toLowerCase()}</Badge>
                      {p.failureReason && <span className="block text-xs text-gray-500">{p.failureReason}</span>}
                    </td>
                    <td className="py-2 text-xs text-gray-500">{formatDateTime(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {refunds.length > 0 && (
        <Card>
          <SectionTitle>Recent refunds</SectionTitle>
          <ul className="divide-y divide-gray-100 text-sm">
            {refunds.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-mono font-bold">{r.payment.order.number}</span> · {r.reason}
                </span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums">{formatNaira(r.amountKobo)}</span>
                  <Badge tone={REFUND_TONE[r.status]}>{r.status.toLowerCase()}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </Page>
  );
}
