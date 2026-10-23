import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { browseProducts } from "@/lib/catalog";
import { listApprovedSupermarkets } from "@/lib/supermarkets";
import { ProductGridList } from "@/components/product-card";
import { SearchBox } from "@/components/search-box";
import { StoreList } from "@/components/store-list";
import { toStoreCards } from "@/components/store-cards";
import { EmptyState, Page, PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const [products, stores] = q ? await Promise.all([browseProducts({ q, pageSize: 10 }), listApprovedSupermarkets(q)]) : [null, []];

  return (
    <Page className="space-y-6">
      <PageTitle title={q ? `Results for “${q}”` : "Search"} subtitle={q ? undefined : "Find products, brands or supermarkets by name or area."} />
      {!q && <SearchBox autoFocus className="lg:hidden" />}
      {q && products && (
        <>
          <section>
            <div className="mb-3 flex items-end justify-between">
              <h2 className="font-extrabold text-gray-900">Products ({products.total})</h2>
              {products.total > products.items.length && (
                <Link href={`/products?q=${encodeURIComponent(q)}`} className="text-sm font-bold text-brand-700 hover:underline">
                  See all {products.total}
                </Link>
              )}
            </div>
            {products.items.length ? <ProductGridList products={products.items} /> : <p className="text-sm text-gray-500">No products match.</p>}
          </section>
          <section>
            <h2 className="mb-3 font-extrabold text-gray-900">Supermarkets ({stores.length})</h2>
            {stores.length ? <StoreList stores={toStoreCards(stores, new Date())} /> : <p className="text-sm text-gray-500">No supermarkets match.</p>}
          </section>
          {products.total === 0 && stores.length === 0 && (
            <EmptyState icon={<SearchX className="h-8 w-8" />} title={`Nothing matches “${q}”`}>
              Try a brand, a product like “rice”, or an area like GRA.
            </EmptyState>
          )}
        </>
      )}
    </Page>
  );
}
