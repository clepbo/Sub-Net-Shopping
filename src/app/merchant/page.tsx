import Link from "next/link";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { availabilityOf, requireMerchantStore } from "@/lib/supermarkets";
import { inventoryCounts } from "@/lib/merchant-products";
import { formatInstant } from "@/lib/time";
import { ApprovalBadge, ApprovalNotice } from "@/components/approval";
import { ServiceBadges, StoreStateBadge } from "@/components/store-status";
import { ClosureControl, PauseControl } from "@/components/forms/merchant-controls";
import { Card, Page, SectionTitle, StatTile } from "@/components/ui";

export default async function MerchantDashboard() {
  const { store } = await requireMerchantStore();
  const now = new Date();
  const a = availabilityOf(store, now);
  const active = (d: Date | null) => (d && d > now ? formatInstant(d) : null);
  const editable = store.status !== "SUSPENDED";
  const counts = await inventoryCounts(store.id);

  const checklist: [string, boolean, string][] = [
    ["Add your logo", Boolean(store.logoUrl), "/merchant/profile"],
    ["Set your map location", store.latitude !== null && store.longitude !== null, "/merchant/profile"],
    ["Set opening hours", store.hours.some((h) => h.isOpen), "/merchant/hours"],
    ["Add your products", counts.total > 0, "/merchant/products"],
    ["Tell us about your POS system", Boolean(store.posProvider), "/merchant/profile#pos"],
  ];

  return (
    <Page>
      <div className="flex items-center justify-between rounded-2xl bg-gray-900 p-4 text-white shadow-md">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-wider text-accent-400 uppercase">Merchant portal</p>
          <h1 className="truncate text-lg font-black">{store.name}</h1>
          <p className="truncate text-xs text-gray-400">{store.address}</p>
        </div>
        <ApprovalBadge status={store.status} />
      </div>

      <ApprovalNotice status={store.status} reason={store.statusReason} kind="supermarket" />

      <Card>
        <SectionTitle
          action={
            store.status === "APPROVED" && (
              <Link href={`/stores/${store.id}`} className="flex items-center gap-1 text-xs font-bold text-brand-700">
                View public page <ExternalLink className="h-3 w-3" aria-hidden />
              </Link>
            )
          }
        >
          What customers see now
        </SectionTitle>
        <div className="space-y-2">
          <StoreStateBadge availability={a} />
          <ServiceBadges availability={a} />
        </div>
      </Card>

      <section>
        <SectionTitle
          action={
            <Link href="/merchant/products" className="text-xs font-bold text-brand-700">
              Manage products
            </Link>
          }
        >
          Products
        </SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label="Listed" value={counts.total} />
          <StatTile label="In stock" value={counts.inStock} tone="green" />
          <Link href="/merchant/products?status=LOW_STOCK">
            <StatTile label="Low stock" value={counts.lowStock} tone={counts.lowStock ? "yellow" : "gray"} />
          </Link>
          <Link href="/merchant/products?status=OUT_OF_STOCK">
            <StatTile label="Out of stock" value={counts.outOfStock} tone={counts.outOfStock ? "red" : "gray"} />
          </Link>
        </div>
      </section>

      {editable && (
        <Card className="space-y-5 divide-y divide-gray-100 [&>*:not(:first-child)]:pt-5">
          <SectionTitle>Live controls</SectionTitle>
          <ClosureControl closed={store.temporarilyClosed} note={store.closureNote} />
          <PauseControl service="delivery" offered={store.deliveryEnabled} pausedUntilLabel={active(store.deliveryPausedUntil)} />
          <PauseControl service="pickup" offered={store.pickupEnabled} pausedUntilLabel={active(store.pickupPausedUntil)} />
        </Card>
      )}

      <Card>
        <SectionTitle>Store setup</SectionTitle>
        <ul className="space-y-1">
          {checklist.map(([label, done, href]) => (
            <li key={label}>
              <Link href={href} className="flex items-center gap-2 rounded-xl px-1 py-1.5 text-sm hover:bg-gray-50">
                {done ? (
                  <CheckCircle2 className="h-5 w-5 text-brand-600" aria-label="Done" />
                ) : (
                  <Circle className="h-5 w-5 text-gray-300" aria-label="To do" />
                )}
                <span className={done ? "text-gray-500 line-through" : "font-medium text-gray-900"}>{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </Page>
  );
}
