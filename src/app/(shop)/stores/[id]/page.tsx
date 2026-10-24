import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, Mail, MapPin, Navigation, Phone } from "lucide-react";
import Form from "next/form";
import { Search } from "lucide-react";
import { getApprovedSupermarket, availabilityOf } from "@/lib/supermarkets";
import { categoryFilterIds, listCategories } from "@/lib/catalog";
import { ProductBrowser, parseBrowse, type BrowseParams } from "@/components/product-browser";
import { directionsUrl } from "@/lib/geo";
import { formatNigerianPhone } from "@/lib/phone";
import { DAY_NAMES, formatClock, lagosClock } from "@/lib/time";
import { StoreLogo } from "@/components/store-logo";
import { ServiceBadge, StoreStateBadge } from "@/components/store-status";
import { Card, Notice, Page, SectionTitle, buttonClass, cx } from "@/components/ui";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<BrowseParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const store = await getApprovedSupermarket((await params).id);
  return { title: store?.name ?? "Supermarket" };
}

function windowText(start: string | null, end: string | null) {
  return start && end ? `${formatClock(start)} – ${formatClock(end)}` : "During store hours";
}

export default async function StorePage({ params, searchParams }: Props) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const store = await getApprovedSupermarket(id);
  if (!store) notFound();
  const { q, sort, inStockOnly, page } = parseBrowse(sp);
  const categories = await listCategories();
  const category = categories.find((c) => c.slug === sp.category);
  const now = new Date();
  const a = availabilityOf(store, now);
  const today = lagosClock(now).dayOfWeek;

  return (
    <Page>
      <div className="flex items-start gap-4">
        <StoreLogo name={store.name} url={store.logoUrl} size="lg" />
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl leading-tight font-extrabold">{store.name}</h1>
          <p className="flex items-center gap-1 text-xs font-bold text-brand-700">
            <BadgeCheck className="h-4 w-4" aria-hidden /> Verified supermarket
          </p>
          <StoreStateBadge availability={a} />
        </div>
      </div>

      {store.temporarilyClosed && (
        <Notice tone="red" title="Temporarily closed">
          {store.closureNote ?? "This supermarket has temporarily closed. Check back later."}
        </Notice>
      )}

      {store.description && <p className="max-w-3xl text-sm text-gray-700">{store.description}</p>}

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
        <aside className="space-y-5 lg:sticky lg:top-40">
          <Card>
            <SectionTitle>Right now</SectionTitle>
            <div className="flex flex-wrap gap-2">
              <ServiceBadge name="Pickup" status={a.pickup} />
              <ServiceBadge name="Delivery" status={a.delivery} />
            </div>
            {a.delivery.state === "PAUSED" && a.pickup.state === "AVAILABLE" && (
              <p className="mt-2 text-xs text-gray-600">Delivery is paused, but you can still Reserve &amp; Pick Up.</p>
            )}
            {a.today ? (
              <p className="mt-3 text-sm text-gray-600">
                Today: {formatClock(a.today.opensAt)} – {formatClock(a.today.closesAt)}
                {store.lastOrderTime && ` · last order ${formatClock(store.lastOrderTime)}`}
              </p>
            ) : (
              <p className="mt-3 text-sm text-gray-600">Closed today</p>
            )}
          </Card>

          <Card>
            <SectionTitle>Location &amp; contact</SectionTitle>
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                <span>
                  {store.address}
                  {store.area && <span className="text-gray-500"> · {store.area}</span>}
                </span>
              </li>
              <li className="flex gap-2">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                <a href={`tel:${store.phone}`} className="font-medium text-brand-800 underline">
                  {formatNigerianPhone(store.phone)}
                </a>
              </li>
              <li className="flex gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                <a href={`mailto:${store.email}`} className="font-medium break-all text-brand-800 underline">
                  {store.email}
                </a>
              </li>
            </ul>
            {store.latitude !== null && store.longitude !== null && (
              <a
                href={directionsUrl(store.latitude, store.longitude)}
                target="_blank"
                rel="noopener noreferrer"
                className={cx(buttonClass("primary"), "mt-4 w-full")}
              >
                <Navigation className="h-4 w-4" aria-hidden /> Get directions
              </a>
            )}
          </Card>

          <Card>
            <SectionTitle>Opening hours</SectionTitle>
            <table className="w-full text-sm">
              <tbody>
                {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                  const h = store.hours.find((x) => x.dayOfWeek === d);
                  return (
                    <tr key={d} className={cx(d === today && "font-bold text-brand-800")}>
                      <th scope="row" className="py-1 text-left font-medium">
                        {DAY_NAMES[d]}
                      </th>
                      <td className="py-1 text-right">
                        {h?.isOpen && h.opensAt && h.closesAt ? `${formatClock(h.opensAt)} – ${formatClock(h.closesAt)}` : "Closed"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-sm text-gray-600">
              <p>
                <span className="font-semibold text-gray-800">Pickup:</span>{" "}
                {store.pickupEnabled ? windowText(store.pickupStart, store.pickupEnd) : "Not offered"}
              </p>
              <p>
                <span className="font-semibold text-gray-800">Delivery:</span>{" "}
                {store.deliveryEnabled ? windowText(store.deliveryStart, store.deliveryEnd) : "Not offered"}
                {store.deliveryEnabled &&
                  store.lastDeliveryOrderTime &&
                  ` · last delivery order ${formatClock(store.lastDeliveryOrderTime)}`}
              </p>
            </div>
          </Card>
        </aside>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold text-gray-900">Products at {store.name}</h2>
            <Form action={`/stores/${store.id}`} className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
              <input
                name="q"
                type="search"
                defaultValue={q}
                placeholder="Search this store"
                aria-label={`Search ${store.name}`}
                className="h-10 w-full rounded-xl border border-gray-300 bg-white pr-3 pl-9 text-sm"
              />
            </Form>
          </div>
          <ProductBrowser
            options={{
              q,
              supermarketId: store.id,
              categoryIds: category ? categoryFilterIds(category) : undefined,
              sort,
              inStockOnly,
              page,
            }}
            params={sp}
            basePath={`/stores/${store.id}`}
            categories={categories.map((c) => ({ value: c.slug, label: c.name }))}
            storeContext
            emptyTitle={q || category ? "No matching products" : "No products listed yet"}
            emptyHint={q || category ? "Try another search or category." : "This supermarket hasn't added products yet."}
          />
          <Notice tone="green" title="Pick up or get it delivered">
            Add items to your cart, then choose Reserve &amp; Pick Up or delivery at checkout.
          </Notice>
        </section>
      </div>
    </Page>
  );
}
