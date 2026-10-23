import type { Prisma } from "@/generated/prisma/client";
import { formatNaira } from "@/lib/money";
import { formatNigerianPhone } from "@/lib/phone";
import { formatDateTime } from "@/lib/time";
import { LogoMark } from "./logo";
import { OrderItemsList, OrderTotals } from "./order-ui";
import { cx } from "./ui";

export type ReceiptOrder = Prisma.OrderGetPayload<{
  include: { items: true; supermarket: true; customer: { select: { firstName: true; lastName: true } }; payments: { include: { refunds: true } } };
}>;

/** Printable receipt. The stamp reflects the backend status, never a screenshot. */
export function Receipt({ order }: { order: ReceiptOrder }) {
  const paid = order.payments.find((p) => p.status === "SUCCEEDED" && !p.failureReason);
  const refunds = order.payments.flatMap((p) => p.refunds).filter((r) => r.status !== "FAILED");
  const stamp =
    order.status === "COLLECTED"
      ? { text: "Collected · code expired", tone: "border-gray-500 text-gray-600" }
      : order.status === "CANCELLED"
        ? { text: order.paymentStatus === "REFUNDED" ? "Cancelled · refunded" : "Cancelled", tone: "border-red-500 text-red-600" }
        : order.paymentStatus === "PAID"
          ? { text: "Paid · awaiting pickup", tone: "border-brand-600 text-brand-700" }
          : { text: "Unpaid", tone: "border-amber-500 text-amber-700" };

  return (
    <article className="relative space-y-5 rounded-2xl border border-gray-200 bg-white p-6 print:border-0 print:p-0">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <LogoMark className="h-10 w-10" />
          <div>
            <p className="font-extrabold">Sub Net Shopping</p>
            <p className="text-xs text-gray-500">Receipt</p>
          </div>
        </div>
        <p className={cx("-rotate-3 rounded-lg border-2 px-2 py-1 text-xs font-black tracking-wide uppercase", stamp.tone)}>{stamp.text}</p>
      </header>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-gray-500">Order</dt>
          <dd className="font-mono font-bold">{order.number}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Placed</dt>
          <dd>{formatDateTime(order.placedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Supermarket</dt>
          <dd>
            {order.supermarket.name}
            <span className="block text-xs text-gray-500">{order.supermarket.address}</span>
            <span className="block text-xs text-gray-500">{formatNigerianPhone(order.supermarket.phone)}</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Customer</dt>
          <dd>
            {order.customer.firstName} {order.customer.lastName}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Payment</dt>
          <dd>
            {order.paymentMethod === "ONLINE" ? "Online (Paystack)" : "At the store"}
            {paid?.channel && <span className="block text-xs text-gray-500 capitalize">{paid.channel.replace(/_/g, " ")}</span>}
            {paid && <span className="block font-mono text-xs text-gray-500">Ref {paid.reference}</span>}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">{order.collectedAt ? "Collected" : "Paid"}</dt>
          <dd>{order.collectedAt ? formatDateTime(order.collectedAt) : order.paidAt ? formatDateTime(order.paidAt) : "—"}</dd>
        </div>
      </dl>

      <div>
        <OrderItemsList items={order.items} />
        <OrderTotals {...order} />
        {refunds.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-sm text-gray-600">
            {refunds.map((r) => (
              <li key={r.id} className="flex justify-between">
                <span>
                  Refund{r.status === "PENDING" ? " (processing)" : ""} · {r.reason}
                </span>
                <span className="tabular-nums">−{formatNaira(r.amountKobo)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-center text-xs text-gray-400">This receipt reflects the order&apos;s status in Sub Net when it was viewed.</p>
    </article>
  );
}
