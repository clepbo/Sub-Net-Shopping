import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Banknote, MapPin, Navigation, Phone, ReceiptText } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { directionsUrl } from "@/lib/geo";
import { formatNaira } from "@/lib/money";
import { formatNigerianPhone } from "@/lib/phone";
import { canTransition, ORDER_STATUS_HELP } from "@/lib/order-rules";
import { paymentDeadline } from "@/lib/payments";
import { formatInstant } from "@/lib/time";
import { CancelOrderButton, PayNowButton } from "@/components/forms/cart-forms";
import { OrderItemsList, OrderProgress, OrderStatusBadge, OrderTimeline, OrderTotals } from "@/components/order-ui";
import { PickupCode } from "@/components/pickup-code";
import { Card, LinkButton, Notice, Page, SectionTitle, buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Order" };

const PAYMENT_NOTICE = {
  success: { tone: "green", title: "Payment received", body: "Your order has been sent to the supermarket." },
  failed: { tone: "red", title: "Payment didn't go through", body: "Nothing was charged. You can try again below." },
  pending: { tone: "yellow", title: "Waiting for Paystack to confirm your payment", body: "This usually takes a few seconds. Refresh this page shortly." },
  refunded: { tone: "yellow", title: "Payment refunded", body: "We couldn't apply your payment to this order, so it's being refunded." },
  error: { tone: "red", title: "We couldn't start the payment", body: "Your order is saved. Try paying again below." },
} as const;

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ placed?: string; payment?: string }> }) {
  const user = await requireUser("CUSTOMER");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const order = await db.order.findFirst({
    where: { id, customerId: user.id },
    include: {
      items: true,
      events: { orderBy: { createdAt: "asc" } },
      supermarket: true,
      payments: { where: { status: "SUCCEEDED" }, include: { refunds: true } },
    },
  });
  if (!order) notFound();
  const s = order.supermarket;
  const notice = PAYMENT_NOTICE[sp.payment as keyof typeof PAYMENT_NOTICE];
  const awaiting = order.status === "AWAITING_PAYMENT";
  const showCode = ["PLACED", "CONFIRMED", "READY_FOR_PICKUP", "COLLECTED"].includes(order.status);
  const refunds = order.payments.flatMap((p) => p.refunds).filter((r) => r.status !== "FAILED");

  return (
    <Page className="mx-auto max-w-3xl">
      <Link href="/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
        <ArrowLeft className="h-4 w-4" aria-hidden /> My orders
      </Link>
      {sp.placed && order.status === "PLACED" && (
        <Notice tone="green" title="Order placed!">
          {s.name} will confirm it shortly. We&apos;ll notify you when it&apos;s ready to collect.
        </Notice>
      )}
      {notice && (
        <Notice tone={notice.tone} title={notice.title}>
          {notice.body}
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
        {!awaiting && <OrderProgress status={order.status} />}
        <p className="text-sm text-gray-700">
          {order.status !== "CANCELLED"
            ? ORDER_STATUS_HELP[order.status]
            : order.cancelReason
              ? order.cancelReason.startsWith("Payment wasn't completed")
                ? order.cancelReason
                : `The supermarket cancelled this order: ${order.cancelReason}`
              : "You cancelled this order."}
          {order.status === "CANCELLED" && order.paymentStatus === "REFUNDED" && " Your payment has been refunded."}
        </p>
        {awaiting && (
          <div className="space-y-2 rounded-xl bg-amber-50 p-3">
            <p className="text-sm text-amber-900">
              Pay by <strong>{formatInstant(paymentDeadline(order.placedAt))}</strong> to keep your items reserved.
            </p>
            <PayNowButton orderId={order.id} totalLabel={formatNaira(order.totalKobo)} />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {canTransition("CUSTOMER", order.status, "CANCELLED") && <CancelOrderButton orderId={order.id} />}
          {(order.paymentStatus !== "UNPAID" || order.status === "COLLECTED") && (
            <LinkButton href={`/orders/${order.id}/receipt`} variant="secondary" size="sm">
              <ReceiptText className="h-4 w-4" aria-hidden /> Receipt
            </LinkButton>
          )}
        </div>
      </Card>

      {showCode && (
        <Card>
          <SectionTitle>Your pickup code</SectionTitle>
          <PickupCode token={order.pickupToken} pin={order.pickupPin} collected={order.status === "COLLECTED"} />
        </Card>
      )}

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
            {order.paymentMethod === "ONLINE"
              ? order.paymentStatus === "PAID"
                ? "Paid online"
                : order.paymentStatus === "REFUNDED"
                  ? "Refunded"
                  : "Not paid yet"
              : order.paymentStatus === "PAID"
                ? "Paid at the store"
                : "Pay at the store when you collect"}
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
          {refunds.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-sm text-gray-600">
              {refunds.map((r) => (
                <li key={r.id} className="flex justify-between gap-2">
                  <span>Refund {r.status === "PENDING" ? "(processing)" : ""}</span>
                  <span className="tabular-nums">−{formatNaira(r.amountKobo)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle>History</SectionTitle>
        <OrderTimeline events={order.events} />
      </Card>
    </Page>
  );
}
