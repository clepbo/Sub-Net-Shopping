import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { requireMerchantStore } from "@/lib/supermarkets";
import { formatNaira } from "@/lib/money";
import { formatNigerianPhone } from "@/lib/phone";
import { canAdjustItems } from "@/lib/order-rules";
import { formatDateTime } from "@/lib/time";
import { AdjustItemForm, OrderActions } from "@/components/forms/merchant-order-forms";
import { OrderItemsList, OrderStatusBadge, OrderTimeline, OrderTotals } from "@/components/order-ui";
import { Card, DefinitionList, Notice, Page, SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Order" };

export default async function MerchantOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { store } = await requireMerchantStore();
  const order = await db.order.findFirst({
    where: { id: (await params).id, supermarketId: store.id },
    include: {
      items: true,
      customer: { select: { firstName: true, lastName: true, phone: true } },
      events: { orderBy: { createdAt: "asc" }, include: { actor: { select: { firstName: true, role: true } } } },
    },
  });
  if (!order) notFound();
  const adjustable = canAdjustItems(order.status);

  return (
    <Page>
      <Link href="/merchant/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Orders
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-wider text-gray-500 uppercase">Order</p>
          <h1 className="font-mono text-2xl font-black">{order.number}</h1>
          <p className="text-sm text-gray-500">Placed {formatDateTime(order.placedAt)}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {order.status === "CANCELLED" && order.cancelReason && (
        <Notice tone="red" title="Cancelled">
          {order.cancelReason}
        </Notice>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <div className="space-y-5">
          <Card>
            <SectionTitle>Items to pick</SectionTitle>
            <OrderItemsList
              items={order.items}
              renderAction={
                adjustable
                  ? (item) => <AdjustItemForm orderItemId={item.id} quantity={item.quantity} requested={item.requestedQuantity} name={item.name} />
                  : undefined
              }
            />
            <OrderTotals {...order} />
            {order.customerNote && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Customer note: {order.customerNote}</p>}
          </Card>
          <Card>
            <SectionTitle>History</SectionTitle>
            <OrderTimeline events={order.events} />
          </Card>
        </div>
        <div className="space-y-5 lg:sticky lg:top-24">
          {order.status !== "COLLECTED" && order.status !== "CANCELLED" && (
            <Card>
              <SectionTitle>Next step</SectionTitle>
              <OrderActions orderId={order.id} status={order.status} totalLabel={formatNaira(order.totalKobo)} />
            </Card>
          )}
          <Card>
            <SectionTitle>Customer</SectionTitle>
            <DefinitionList
              items={[
                ["Name", `${order.customer.firstName} ${order.customer.lastName}`],
                [
                  "Phone",
                  <a key="p" href={`tel:${order.customer.phone}`} className="inline-flex items-center gap-1 text-brand-800 underline">
                    <Phone className="h-3.5 w-3.5" aria-hidden /> {formatNigerianPhone(order.customer.phone)}
                  </a>,
                ],
                ["Fulfilment", "Reserve & Pick Up"],
                ["Payment", order.paymentStatus === "PAID" ? "Paid at store" : "To pay at store"],
              ]}
            />
          </Card>
        </div>
      </div>
    </Page>
  );
}
