import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Banknote, MapPin, Navigation, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { directionsUrl } from "@/lib/geo";
import { formatNigerianPhone } from "@/lib/phone";
import { canTransition, ORDER_STATUS_HELP } from "@/lib/order-rules";
import { CancelOrderButton } from "@/components/forms/cart-forms";
import { OrderItemsList, OrderProgress, OrderStatusBadge, OrderTimeline, OrderTotals } from "@/components/order-ui";
import { Card, Notice, Page, SectionTitle, buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Order" };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ placed?: string }> }) {
  const user = await requireUser("CUSTOMER");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const order = await db.order.findFirst({
    where: { id, customerId: user.id },
    include: { items: true, events: { orderBy: { createdAt: "asc" } }, supermarket: true },
  });
  if (!order) notFound();
  const s = order.supermarket;

  return (
    <Page className="mx-auto max-w-3xl">
      <Link href="/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
        <ArrowLeft className="h-4 w-4" aria-hidden /> My orders
      </Link>
      {sp.placed && (
        <Notice tone="green" title="Order placed!">
          {s.name} will confirm it shortly. We&apos;ll notify you when it&apos;s ready to collect.
        </Notice>
      )}

      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-wider text-gray-500 uppercase">Order number</p>
            <p className="font-mono text-2xl font-black tracking-wide">{order.number}</p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
        <OrderProgress status={order.status} />
        <p className="text-sm text-gray-700">
          {order.status !== "CANCELLED"
            ? ORDER_STATUS_HELP[order.status]
            : order.cancelReason
              ? `The supermarket cancelled this order: ${order.cancelReason}`
              : "You cancelled this order."}
        </p>
        {canTransition("CUSTOMER", order.status, "CANCELLED") && <CancelOrderButton orderId={order.id} />}
      </Card>

      <div className="grid gap-5 md:grid-cols-2 md:items-start">
        <Card className="space-y-3">
          <SectionTitle>Pick up at</SectionTitle>
          <p className="font-bold">{s.name}</p>
          <p className="flex gap-1.5 text-sm text-gray-600">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {s.address}
            {s.area && `, ${s.area}`}
          </p>
          <p className="flex gap-1.5 text-sm">
            <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
            <a href={`tel:${s.phone}`} className="font-medium text-brand-800 underline">
              {formatNigerianPhone(s.phone)}
            </a>
          </p>
          <p className="flex gap-1.5 text-sm text-gray-600">
            <Banknote className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {order.paymentStatus === "PAID" ? "Paid at the store" : "Pay at the store when you collect"}
          </p>
          {s.latitude !== null && s.longitude !== null && (
            <a href={directionsUrl(s.latitude, s.longitude)} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>
              <Navigation className="h-4 w-4" aria-hidden /> Directions
            </a>
          )}
          {order.customerNote && <p className="rounded-xl bg-gray-50 p-2 text-sm text-gray-700">Your note: {order.customerNote}</p>}
        </Card>
        <Card>
          <SectionTitle>Items</SectionTitle>
          <OrderItemsList items={order.items} />
          <OrderTotals {...order} />
        </Card>
      </div>

      <Card>
        <SectionTitle>History</SectionTitle>
        <OrderTimeline events={order.events} />
      </Card>
    </Page>
  );
}
