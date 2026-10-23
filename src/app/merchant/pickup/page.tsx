import type { Metadata } from "next";
import Form from "next/form";
import { CheckCircle2, ScanLine, XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { requireMerchantStore } from "@/lib/supermarkets";
import { findOrderForPickup } from "@/lib/pickup";
import { formatNaira } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { CollectForm, MarkReadyForm } from "@/components/forms/pickup-forms";
import { OrderItemsList, OrderStatusBadge } from "@/components/order-ui";
import { Card, Notice, Page, PageTitle, SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Pickup" };

type SP = { token?: string; pin?: string; collected?: string };

/**
 * Staff pickup screen (PRD §13). Scanning a customer's QR code with the
 * phone camera opens this page with ?token=…; otherwise staff type the PIN.
 */
export default async function PickupPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { store } = await requireMerchantStore();
  const sp = await searchParams;
  const credential = { token: sp.token || undefined, pin: sp.pin || undefined };
  const lookup = credential.token || credential.pin ? await findOrderForPickup(store.id, credential) : null;
  const order = lookup?.ok
    ? await db.order.findUniqueOrThrow({ where: { id: lookup.orderId }, include: { items: true, customer: { select: { firstName: true, lastName: true } } } })
    : null;
  const recent = await db.order.findMany({
    where: { supermarketId: store.id, status: "COLLECTED" },
    orderBy: { collectedAt: "desc" },
    take: 5,
    select: { id: true, number: true, collectedAt: true, totalKobo: true },
  });

  return (
    <Page className="max-w-2xl">
      <PageTitle eyebrow="Merchant" title="Verify a pickup" subtitle="Check the customer's code before handing over an order." />

      <Card className="space-y-3">
        <div className="flex gap-3 text-sm text-gray-600">
          <ScanLine className="h-5 w-5 shrink-0 text-brand-700" aria-hidden />
          <p>Scan the customer&apos;s QR code with your phone camera, or type their 6-digit PIN.</p>
        </div>
        <Form action="/merchant/pickup" className="flex gap-2">
          <input
            name="pin"
            inputMode="numeric"
            autoComplete="off"
            maxLength={7}
            defaultValue={sp.pin ?? ""}
            placeholder="000000"
            aria-label="Pickup PIN"
            className="h-12 min-w-0 flex-1 rounded-xl border border-gray-300 px-3 text-center font-mono text-2xl tracking-[0.3em]"
          />
          <button className="h-12 rounded-xl bg-brand-700 px-5 font-bold text-white">Check</button>
        </Form>
      </Card>

      {sp.collected && !lookup && (
        <div className="flex gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-brand-900" role="status">
          <CheckCircle2 className="h-6 w-6 shrink-0" aria-hidden />
          <div>
            <p className="font-bold">Order {sp.collected} collected</p>
            <p className="text-sm">The pickup code is now used up. Ready for the next customer.</p>
          </div>
        </div>
      )}

      {lookup && !lookup.ok && (
        <div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900" role="alert">
          <XCircle className="h-6 w-6 shrink-0" aria-hidden />
          <div>
            <p className="font-bold">Don&apos;t hand anything over</p>
            <p className="text-sm">{lookup.reason}</p>
          </div>
        </div>
      )}

      {order && (
        <Card className="space-y-4 border-brand-500 ring-1 ring-brand-500">
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-3">
              <CheckCircle2 className="h-7 w-7 shrink-0 text-brand-600" aria-hidden />
              <div>
                <p className="text-xs font-bold tracking-wider text-gray-500 uppercase">Valid code</p>
                <p className="font-mono text-2xl font-black">{order.number}</p>
                <p className="text-sm text-gray-600">
                  {order.customer.firstName} {order.customer.lastName}
                </p>
              </div>
            </div>
            <OrderStatusBadge status={order.status} />
          </div>

          {order.paymentStatus === "PAID" ? (
            <Notice tone="green" title={`Paid online · ${formatNaira(order.totalKobo)}`}>
              Nothing to collect from the customer.
            </Notice>
          ) : (
            <Notice tone="yellow" title={`Collect ${formatNaira(order.totalKobo)} from the customer`}>
              Pay at the store: take cash, card or transfer before handing over.
            </Notice>
          )}

          <div>
            <SectionTitle>Items</SectionTitle>
            <OrderItemsList items={order.items.filter((i) => i.quantity > 0)} />
          </div>

          {order.status === "READY_FOR_PICKUP" ? (
            <CollectForm
              orderId={order.id}
              token={credential.token}
              pin={credential.pin}
              label={order.paymentStatus === "PAID" ? "Confirm handed over" : `Payment received & handed over`}
            />
          ) : order.status === "CONFIRMED" ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">This order is still being prepared. Mark it ready once it&apos;s bagged.</p>
              <MarkReadyForm orderId={order.id} />
            </div>
          ) : (
            <p className="text-sm text-gray-600">Confirm this order and prepare it before handing it over.</p>
          )}
        </Card>
      )}

      {recent.length > 0 && (
        <Card>
          <SectionTitle>Recently collected</SectionTitle>
          <ul className="divide-y divide-gray-100 text-sm">
            {recent.map((o) => (
              <li key={o.id} className="flex justify-between py-2">
                <span className="font-mono font-bold">{o.number}</span>
                <span className="text-gray-500">{o.collectedAt && formatDateTime(o.collectedAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </Page>
  );
}
