import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { platformStats } from "@/lib/admin";
import { formatNaira } from "@/lib/money";
import { ActivityList } from "@/components/activity-list";
import { Card, LinkButton, Page, PageTitle, SectionTitle, StatTile } from "@/components/ui";
import { Bike, Store } from "lucide-react";
import { formatDateTime } from "@/lib/time";

export default async function AdminOverview() {
  await requireUser("ADMIN");
  const [stats, recent, pendingStores, pendingRiders] = await Promise.all([
    platformStats(),
    db.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actor: { select: { firstName: true, lastName: true } } },
    }),
    db.supermarket.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 10 }),
    db.rider.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 10, include: { user: { select: { firstName: true, lastName: true } } } }),
  ]);

  return (
    <Page>
      <PageTitle eyebrow="Admin" title="Platform overview" subtitle="Live figures from the SubNet database." />

      {(pendingStores.length > 0 || pendingRiders.length > 0) && (
        <Card className="space-y-3 border-accent-400 bg-accent-300/20">
          <SectionTitle>Waiting for your approval</SectionTitle>
          <ul className="divide-y divide-accent-300/60">
            {pendingStores.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2">
                <Store className="h-5 w-5 shrink-0 text-brand-700" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{s.name}</p>
                  <p className="truncate text-xs text-gray-600">Supermarket · {s.address} · registered {formatDateTime(s.createdAt)}</p>
                </div>
                <LinkButton href={`/admin/supermarkets/${s.id}`} size="sm">
                  Review
                </LinkButton>
              </li>
            ))}
            {pendingRiders.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2">
                <Bike className="h-5 w-5 shrink-0 text-brand-700" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">
                    {r.user.firstName} {r.user.lastName}
                  </p>
                  <p className="truncate text-xs text-gray-600">Rider · {r.plateNumber} · registered {formatDateTime(r.createdAt)}</p>
                </div>
                <LinkButton href={`/admin/riders/${r.id}`} size="sm">
                  Review
                </LinkButton>
              </li>
            ))}
          </ul>
          {(stats.supermarkets.PENDING > pendingStores.length || stats.riders.PENDING > pendingRiders.length) && (
            <p className="text-xs">
              <Link href="/admin/supermarkets?status=PENDING" className="font-bold underline">
                All pending supermarkets
              </Link>{" "}
              ·{" "}
              <Link href="/admin/riders?status=PENDING" className="font-bold underline">
                All pending riders
              </Link>
            </p>
          )}
        </Card>
      )}

      <section className="space-y-2">
        <SectionTitle
          action={
            <Link href="/admin/orders" className="text-xs font-bold text-brand-700">
              All orders
            </Link>
          }
        >
          Orders
        </SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Today" value={stats.ordersToday} tone="blue" />
          <StatTile label="In progress" value={stats.openOrders} tone={stats.openOrders ? "yellow" : "gray"} />
          <StatTile label="Completed" value={formatNaira(stats.collectedValueKobo)} tone="green" hint={`${stats.collectedOrders} orders`} />
        </div>
      </section>

      <section className="space-y-2">
        <SectionTitle>Supermarkets</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Total" value={stats.supermarkets.total} />
          <StatTile label="Approved" value={stats.supermarkets.APPROVED} tone="green" />
          <StatTile label="Pending" value={stats.supermarkets.PENDING} tone="yellow" />
        </div>
      </section>

      <section className="space-y-2">
        <SectionTitle>Riders</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Total" value={stats.riders.total} />
          <StatTile label="Online now" value={stats.activeRiders} tone="green" />
          <StatTile label="Pending" value={stats.riders.PENDING} tone="yellow" />
        </div>
      </section>

      <section className="space-y-2">
        <SectionTitle
          action={
            <Link href="/admin/categories" className="text-xs font-bold text-brand-700">
              Categories
            </Link>
          }
        >
          Catalogue
        </SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <StatTile label="Products" value={stats.products} hint="Unique catalogue items" />
          <StatTile label="Store listings" value={stats.listings} hint="Across all supermarkets" />
        </div>
      </section>

      <section className="space-y-2">
        <SectionTitle>Accounts</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <StatTile label="Customers" value={stats.customers} tone="blue" />
          <StatTile label="Suspended accounts" value={stats.suspendedAccounts} tone={stats.suspendedAccounts ? "red" : "gray"} />
        </div>
      </section>

      <Card>
        <SectionTitle
          action={
            <Link href="/admin/activity" className="text-xs font-bold text-brand-700">
              View all
            </Link>
          }
        >
          Recent activity
        </SectionTitle>
        <ActivityList entries={recent} />
      </Card>
    </Page>
  );
}
