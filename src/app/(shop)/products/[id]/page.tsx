import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, MapPin, Trophy } from "lucide-react";
import { browseProducts, getProductWithOffers } from "@/lib/catalog";
import { AVAILABILITY_LABEL } from "@/lib/inventory";
import { formatNaira } from "@/lib/money";
import { availabilityOf } from "@/lib/supermarkets";
import { ProductGallery } from "@/components/product-gallery";
import { ProductRail } from "@/components/product-card";
import { StoreLogo } from "@/components/store-logo";
import { ServiceBadges, StoreStateBadge } from "@/components/store-status";
import { Badge, Card, Notice, Page, SectionTitle, cx } from "@/components/ui";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductWithOffers((await params).id);
  return product ? { title: product.name, description: product.description ?? undefined } : { title: "Product" };
}

export default async function ProductPage({ params }: Props) {
  const product = await getProductWithOffers((await params).id);
  if (!product) notFound();
  const now = new Date();
  const offers = product.inventory;
  const inStock = offers.filter((o) => o.availability !== "OUT_OF_STOCK");
  const cheapest = (inStock[0] ?? offers[0]).priceKobo;
  const highest = offers[offers.length - 1].priceKobo;
  const related = product.categoryId
    ? (await browseProducts({ categoryIds: [product.categoryId], pageSize: 11 })).items.filter((p) => p.id !== product.id).slice(0, 10)
    : [];

  return (
    <Page className="lg:space-y-8">
      <nav className="text-xs text-gray-500" aria-label="Breadcrumb">
        <Link href="/categories" className="hover:underline">
          Categories
        </Link>
        {product.category?.parent && (
          <>
            {" / "}
            <Link href={`/categories/${product.category.parent.slug}`} className="hover:underline">
              {product.category.parent.name}
            </Link>
          </>
        )}
        {product.category && (
          <>
            {" / "}
            <Link href={`/categories/${product.category.slug}`} className="hover:underline">
              {product.category.name}
            </Link>
          </>
        )}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
        <ProductGallery images={product.images} name={product.name} />

        <div className="space-y-5">
          <div className="space-y-1">
            {product.brand && <p className="text-xs font-bold tracking-wide text-gray-500 uppercase">{product.brand}</p>}
            <h1 className="text-2xl leading-tight font-extrabold text-gray-900 lg:text-3xl">{product.name}</h1>
            {product.unit && <p className="text-gray-600">{product.unit}</p>}
          </div>

          <div className="rounded-2xl bg-brand-50 p-4">
            <p className="text-xs font-bold tracking-wide text-brand-800 uppercase">
              {offers.length > 1 ? `Price across ${offers.length} supermarkets` : "Price"}
            </p>
            <p className="text-3xl font-black text-brand-900">
              {formatNaira(cheapest)}
              {highest !== cheapest && <span className="text-lg font-bold text-brand-700"> – {formatNaira(highest)}</span>}
            </p>
            {offers.length > 1 && highest > cheapest && (
              <p className="mt-1 text-sm text-brand-800">
                Save up to <strong>{formatNaira(highest - cheapest)}</strong> by choosing the cheapest supermarket.
              </p>
            )}
            {inStock.length === 0 && <p className="mt-1 text-sm font-semibold text-red-700">Currently out of stock everywhere.</p>}
          </div>

          {product.description && <p className="text-sm leading-relaxed whitespace-pre-line text-gray-700">{product.description}</p>}

          <Notice tone="blue" title="Ordering is coming soon">
            Cart, checkout and Reserve &amp; Pick Up are being added next. For now, compare prices and visit the store.
          </Notice>
        </div>
      </div>

      <section>
        <SectionTitle>Compare supermarkets</SectionTitle>
        <ul className="space-y-3">
          {offers.map((offer) => {
            const a = availabilityOf(offer.supermarket, now);
            const isCheapest = offer.priceKobo === cheapest && offer.availability !== "OUT_OF_STOCK";
            const s = offer.supermarket;
            return (
              <li key={offer.id}>
                <Card className={cx("flex flex-col gap-3 sm:flex-row sm:items-center", isCheapest && offers.length > 1 && "border-brand-500 ring-1 ring-brand-500")}>
                  <Link href={`/stores/${s.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <StoreLogo name={s.name} url={s.logoUrl} />
                    <div className="min-w-0 space-y-1">
                      <p className="flex items-center gap-1 font-bold text-gray-900">
                        {s.name} <BadgeCheck className="h-4 w-4 shrink-0 text-brand-600" aria-label="Verified" />
                      </p>
                      <p className="flex items-center gap-1 truncate text-xs text-gray-500">
                        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        {s.area ? `${s.area} · ` : ""}
                        {s.address}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <StoreStateBadge availability={a} />
                        <ServiceBadges availability={a} />
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-3 sm:block sm:border-0 sm:pt-0 sm:text-right">
                    <div>
                      <p className="text-xl font-black text-gray-900">{formatNaira(offer.priceKobo)}</p>
                      {offer.priceKobo > cheapest && <p className="text-xs text-gray-500">+{formatNaira(offer.priceKobo - cheapest)}</p>}
                    </div>
                    <div className="flex flex-wrap justify-end gap-1.5 sm:mt-1">
                      {isCheapest && offers.length > 1 && (
                        <Badge tone="yellow">
                          <Trophy className="h-3 w-3" aria-hidden /> Lowest price
                        </Badge>
                      )}
                      <Badge tone={offer.availability === "OUT_OF_STOCK" ? "red" : offer.availability === "LOW_STOCK" ? "yellow" : "green"}>
                        {AVAILABILITY_LABEL[offer.availability]}
                      </Badge>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      {related.length > 0 && product.category && (
        <ProductRail title={`More in ${product.category.name}`} href={`/categories/${product.category.slug}`} products={related} />
      )}
    </Page>
  );
}
