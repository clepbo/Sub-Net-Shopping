import type { Metadata } from "next";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { db } from "@/lib/db";
import { requireMerchantStore } from "@/lib/supermarkets";
import { orderCounts, ORDER_TABS } from "@/lib/merchant-orders";
import { formatNaira } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { OrderStatusBadge } from "@/components/order-ui";
import { EmptyState, Page, PageTitle, cx } from "@/components/ui";

export const metadata: Metadata = { title: "Orders" };

export default async function MerchantOrders({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { store } = await requireMerchantStore();
  const sp = await searchParams;
  const tab = ORDER_TABS.find((t) => t.key === sp.tab) ?? ORDER_TABS[0];
  const [orders, counts] = await Promise.all([
    db.order.findMany({
      where: { supermarketId: store.id, status: { in: tab.statuses } },
      // Oldest first while there's work to do; newest first in history.
      orderBy: { placedAt: tab.key === "done" || tab.key === "cancelled" ? "desc" : "asc" },
      take: 100,
      include: { customer: { select: { firstName: true, lastName: true } }, _count: { select: { items: true } } },
    }),
    orderCounts(store.id),
  ]);

  return (
    <Page>
      <PageTitle eyebrow="Merchant" title="Orders" subtitle="Reserve & Pick Up orders. Customers pay at the store on collection." />
      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4" aria-label="Order status">
        {ORDER_TABS.map((t) => {
          const count = t.statuses.reduce((n, s) => n + counts[s], 0);
          const active = t.key === tab.key;
          return (
            <Link
              key={t.key}
              href={`/merchant/orders?tab=${t.key}`}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-bold",
                active ? "border-brand-700 bg-brand-700 text-white" : "border-gray-300 bg-white text-gray-700",
              )}
            >
              {t.label}
              {count > 0 && (
                <span className={cx("rounded-full px-1.5 text-xs", active ? "bg-white/20" : t.key === "new" ? "bg-accent-400 text-brand-950" : "bg-gray-100")}>{count}</span>
              )}
            </Link>
          );
        })}
      </nav>
      {orders.length === 0 ? (
        <EmptyState icon={<Receipt className="h-8 w-8" />} title={`No ${tab.label.toLowerCase()} orders`} />
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/merchant/orders/${o.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-gray-50">
                <div className="min-w-0">
                  <p className="font-mono font-bold">{o.number}</p>
                  <p className="truncate text-sm text-gray-600">
                    {o.fulfilment === "DELIVERY" ? "🛵 Delivery" : "Pickup"} · {o.customer.firstName} {o.customer.lastName} · {o._count.items} item{o._count.items === 1 ? "" : "s"}
                  </p>
                  <p className="text-xs text-gray-400">{formatDateTime(o.placedAt)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="font-extrabold tabular-nums">{formatNaira(o.totalKobo)}</span>
                  <OrderStatusBadge status={o.status} fulfilment={o.fulfilment} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
