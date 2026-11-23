import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ListChecks, MapPin, Navigation, Trophy } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { findStoresForList, parseListParam } from "@/lib/basket";
import type { RankedStore } from "@/lib/basket-rank";
import { directionsUrl } from "@/lib/geo";
import { formatNaira } from "@/lib/money";
import { ProductImage } from "@/components/product-card";
import { StoreLogo } from "@/components/store-logo";
import { ClearList, ListSync, RemoveFromList, UseMyLocation } from "@/components/shopping-list";
import { AddListToCart } from "@/components/forms/basket-forms";
import { Badge, Card, EmptyState, LinkButton, Page, PageTitle, SectionTitle, cx } from "@/components/ui";

export const metadata: Metadata = { title: "Find a store with everything" };

type Search = { items?: string; lat?: string; lng?: string; near?: string };

function coord(v: string | undefined, max: number) {
  const n = Number(v);
  return v && Number.isFinite(n) && Math.abs(n) <= max ? n : null;
}

const km = (d: number | null) => (d === null ? null : d < 1 ? `${Math.round(d * 1000)} m away` : `${d.toFixed(1)} km away`);

export default async function BasketPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const ids = parseListParam(sp.items);
  const user = await getCurrentUser();
  const addresses = user?.role === "CUSTOMER" ? await db.customerAddress.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }) : [];

  // Where to measure from: the phone's location, a chosen saved address, or the latest saved address.
  const lat = coord(sp.lat, 90);
  const lng = coord(sp.lng, 180);
  const chosen = addresses.find((a) => a.id === sp.near) ?? (lat === null ? addresses[0] : undefined);
  const origin = lat !== null && lng !== null ? { lat, lng } : chosen ? { lat: chosen.latitude, lng: chosen.longitude } : null;
  const originLabel = lat !== null ? "your current location" : chosen ? chosen.label : null;

  const { list, result } = ids.length ? await findStoresForList(ids, origin) : { list: [], result: null };
  const name = new Map(list.map((p) => [p.id, p.name]));
  const returnTo = `/basket?items=${ids.join(",")}`;
  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ ...(ids.length ? { items: ids.join(",") } : {}), ...extra });
    return `/basket?${p}`;
  };

  return (
    <Page>
      <ListSync urlIds={ids} />
      <PageTitle
        eyebrow="Shopping list"
        title="Find one store with everything"
        subtitle="Add products to your list, and we'll show the closest supermarket that has all of them in stock."
      />

      {list.length === 0 ? (
        <EmptyState icon={<ListChecks className="h-8 w-8" />} title="Your list is empty">
          <p className="mb-4 text-sm text-gray-500">Tap “Add to list” on any product. Add a few, then come back here.</p>
          <LinkButton href="/products">Browse products</LinkButton>
        </EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
          <aside className="space-y-4">
            <Card className="space-y-3">
              <SectionTitle action={<ClearList />}>
                Your list ({list.length})
              </SectionTitle>
              <ul className="divide-y divide-gray-100">
                {list.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2">
                    <ProductImage src={p.images[0]?.url ?? null} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-gray-100" />
                    <Link href={`/products/${p.id}`} className="min-w-0 flex-1 text-sm font-semibold hover:underline">
                      <span className="line-clamp-2">{p.name}</span>
                      {p.unit && <span className="block text-xs font-normal text-gray-500">{p.unit}</span>}
                    </Link>
                    {result?.unavailable.includes(p.id) && <Badge tone="red">None in stock</Badge>}
                    <RemoveFromList productId={p.id} />
                  </li>
                ))}
              </ul>
              <Link href="/products" className="text-sm font-bold text-brand-700 underline">
                + Add more products
              </Link>
            </Card>
            <Card className="space-y-2">
              <SectionTitle>Distance from</SectionTitle>
              <p className="flex items-center gap-1.5 text-sm">
                <MapPin className="h-4 w-4 text-brand-700" aria-hidden />
                {originLabel ? <span className="font-semibold">{originLabel}</span> : <span className="text-gray-500">No location set: sorted by price</span>}
              </p>
              <UseMyLocation active={lat !== null} />
              {addresses.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {addresses.map((a) => (
                    <Link
                      key={a.id}
                      href={qs({ near: a.id })}
                      className={cx(
                        "rounded-full border px-3 py-1 text-xs font-bold",
                        chosen?.id === a.id && lat === null ? "border-brand-700 bg-brand-50 text-brand-800" : "border-gray-300 text-gray-700",
                      )}
                    >
                      {a.label}
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </aside>

          <section className="space-y-4">
            {result && result.stores.length === 0 && (
              <EmptyState icon={<AlertTriangle className="h-8 w-8" />} title="No supermarket has these in stock right now">
                <p className="text-sm text-gray-500">Try removing some items or check back later.</p>
              </EmptyState>
            )}

            {result?.bestComplete && (
              <StoreResult
                store={result.bestComplete}
                total={list.length}
                names={name}
                returnTo={returnTo}
                highlight={
                  <span className="flex items-center gap-1.5 text-sm font-extrabold text-brand-800">
                    <Trophy className="h-4 w-4 text-accent-500" aria-hidden />
                    {origin ? "Closest store with everything on your list" : "Cheapest store with everything on your list"}
                  </span>
                }
              />
            )}

            {result?.closerPartial && (
              <StoreResult
                store={result.closerPartial}
                total={list.length}
                names={name}
                returnTo={returnTo}
                highlight={
                  <span className="flex items-center gap-1.5 text-sm font-extrabold text-amber-800">
                    <AlertTriangle className="h-4 w-4" aria-hidden />
                    {result.bestComplete ? "Closer, but missing some items" : "Closest store, but no store has everything"}
                  </span>
                }
              />
            )}

            {result && result.stores.length > 1 && (
              <div className="space-y-2">
                <SectionTitle>All stores with items from your list</SectionTitle>
                <ul className="space-y-2">
                  {result.stores
                    .filter((s) => s.id !== result.bestComplete?.id && s.id !== result.closerPartial?.id)
                    .map((s) => (
                      <li key={s.id}>
                        <Link href={`/stores/${s.id}`} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 hover:border-brand-500">
                          <StoreLogo name={s.name} url={s.logoUrl} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-bold">{s.name}</p>
                            <p className="text-xs text-gray-500">
                              {[km(s.distanceKm), s.area].filter(Boolean).join(" · ")}
                            </p>
                            <p className={cx("text-xs font-bold", s.complete ? "text-brand-700" : "text-amber-700")}>
                              {s.complete ? "Has everything" : `Has ${s.have.length} of ${list.length}`} · {formatNaira(s.totalKobo)}
                            </p>
                          </div>
                        </Link>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      )}
    </Page>
  );
}

function StoreResult({
  store,
  total,
  names,
  returnTo,
  highlight,
}: {
  store: RankedStore;
  total: number;
  names: Map<string, string>;
  returnTo: string;
  highlight: React.ReactNode;
}) {
  return (
    <Card className={cx("space-y-4", store.complete ? "border-brand-600 ring-1 ring-brand-600" : "border-amber-300")}>
      {highlight}
      <div className="flex items-center gap-3">
        <StoreLogo name={store.name} url={store.logoUrl} />
        <div className="min-w-0 flex-1">
          <Link href={`/stores/${store.id}`} className="block truncate text-lg font-extrabold hover:underline">
            {store.name}
          </Link>
          <p className="truncate text-sm text-gray-500">{store.address}</p>
          <p className="text-sm font-semibold text-gray-700">{[km(store.distanceKm), `${store.have.length} of ${total} items`].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-bold text-gray-500 uppercase">One of each</p>
          <p className="text-xl font-black text-brand-900">{formatNaira(store.totalKobo)}</p>
        </div>
      </div>
      {store.missing.length > 0 && (
        <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-bold">Out of stock here:</p>
          <ul className="mt-1 list-disc pl-5">
            {store.missing.map((id) => (
              <li key={id}>{names.get(id)}</li>
            ))}
          </ul>
        </div>
      )}
      <ul className="grid gap-1 text-sm sm:grid-cols-2">
        {store.have.map((o) => (
          <li key={o.productId} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-2 py-1">
            <span className="flex min-w-0 items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-brand-700" aria-hidden />
              <span className="truncate">{names.get(o.productId)}</span>
              {o.lowStock && <Badge tone="yellow">Few left</Badge>}
            </span>
            <span className="shrink-0 font-semibold">{formatNaira(o.priceKobo)}</span>
          </li>
        ))}
      </ul>
      <div className="grid gap-2 sm:grid-cols-2">
        <AddListToCart
          supermarketId={store.id}
          inventoryIds={store.have.map((o) => o.inventoryId)}
          returnTo={returnTo}
          label={store.complete ? "Add all to cart" : `Add the ${store.have.length} available to cart`}
        />
        {store.latitude !== null && store.longitude !== null && (
          <a href={directionsUrl(store.latitude, store.longitude)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-300 text-sm font-bold text-gray-800 hover:border-brand-600">
            <Navigation className="h-4 w-4" aria-hidden /> Directions
          </a>
        )}
      </div>
    </Card>
  );
}
