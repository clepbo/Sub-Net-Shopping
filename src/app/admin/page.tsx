import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { platformStats } from "@/lib/admin";
import { formatNaira } from "@/lib/money";
import { ActivityList } from "@/components/activity-list";
import { Card, Page, PageTitle, SectionTitle, StatTile } from "@/components/ui";

export default async function AdminOverview() {
  await requireUser("ADMIN");
  const [stats, recent] = await Promise.all([
    platformStats(),
    db.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actor: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  return (
    <Page>
      <PageTitle eyebrow="Admin" title="Platform overview" subtitle="Live figures from the Sub Net database." />

      {(stats.supermarkets.PENDING > 0 || stats.riders.PENDING > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <Link href="/admin/supermarkets?status=PENDING" className="rounded-2xl bg-accent-400 p-3 text-brand-950 shadow-sm">
            <p className="text-2xl font-black">{stats.supermarkets.PENDING}</p>
            <p className="text-xs font-bold">supermarkets to review →</p>
          </Link>
          <Link href="/admin/riders?status=PENDING" className="rounded-2xl bg-accent-400 p-3 text-brand-950 shadow-sm">
            <p className="text-2xl font-black">{stats.riders.PENDING}</p>
            <p className="text-xs font-bold">riders to review →</p>
          </Link>
        </div>
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
