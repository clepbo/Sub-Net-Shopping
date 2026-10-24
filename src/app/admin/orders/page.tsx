import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatNaira } from "@/lib/money";
import { ORDER_STATUS_LABEL } from "@/lib/order-rules";
import { formatDateTime } from "@/lib/time";
import type { OrderStatus } from "@/generated/prisma/enums";
import { FilterTabs } from "@/components/admin-tabs";
import { OrderStatusBadge } from "@/components/order-ui";
import { EmptyState, Page, PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Orders" };

const STATUSES: OrderStatus[] = ["PLACED", "CONFIRMED", "READY_FOR_PICKUP", "COLLECTED", "CANCELLED"];

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireUser("ADMIN");
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);
  const [orders, counts] = await Promise.all([
    db.order.findMany({
      where: status ? { status } : {},
      orderBy: { placedAt: "desc" },
      take: 200,
      include: { supermarket: { select: { name: true } }, customer: { select: { firstName: true, lastName: true } } },
    }),
    db.order.groupBy({ by: ["status"], _count: true }),
  ]);
  return (
    <Page>
      <PageTitle eyebrow="Admin" title="Orders" subtitle="Every order across Sub Net, newest first." />
      <FilterTabs
        base="/admin/orders"
        current={status ?? ""}
        tabs={[
          { value: "", label: "All", count: counts.reduce((n, c) => n + c._count, 0) },
          ...STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_LABEL[s], count: counts.find((c) => c.status === s)?._count ?? 0 })),
        ]}
      />
      {orders.length === 0 ? (
        <EmptyState title="No orders" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-2">Order</th>
                <th className="px-4 py-2">Supermarket</th>
                <th className="px-4 py-2">Customer</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-2">
                    <span className="font-mono font-bold">{o.number}</span>
                    <span className="block text-xs text-gray-500">{formatDateTime(o.placedAt)}</span>
                  </td>
                  <td className="px-4 py-2">{o.supermarket.name}</td>
                  <td className="px-4 py-2">
                    {o.customer.firstName} {o.customer.lastName}
                  </td>
                  <td className="px-4 py-2 text-right font-bold tabular-nums">{formatNaira(o.totalKobo)}</td>
                  <td className="px-4 py-2">
                    <OrderStatusBadge status={o.status} fulfilment={o.fulfilment} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}
