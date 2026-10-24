import type { Metadata } from "next";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatNaira } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { OrderStatusBadge } from "@/components/order-ui";
import { EmptyState, LinkButton, Page, PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "My orders" };

export default async function OrdersPage() {
  const user = await requireUser("CUSTOMER");
  const orders = await db.order.findMany({
    where: { customerId: user.id },
    orderBy: { placedAt: "desc" },
    take: 100,
    include: { supermarket: { select: { name: true } }, _count: { select: { items: true } } },
  });
  return (
    <Page>
      <PageTitle title="My orders" />
      {orders.length === 0 ? (
        <EmptyState icon={<Receipt className="h-8 w-8" />} title="No orders yet">
          <LinkButton href="/products" size="sm" className="mt-4">
            Start shopping
          </LinkButton>
        </EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/orders/${o.id}`} className="block rounded-2xl border border-gray-200 bg-white p-4 hover:border-brand-500">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{o.supermarket.name}</p>
                    <p className="text-xs text-gray-500">
                      {o.number} · {formatDateTime(o.placedAt)}
                    </p>
                  </div>
                  <OrderStatusBadge status={o.status} fulfilment={o.fulfilment} />
                </div>
                <p className="mt-2 text-sm text-gray-600">
                  {o._count.items} item{o._count.items === 1 ? "" : "s"} · <span className="font-bold text-gray-900">{formatNaira(o.totalKobo)}</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
