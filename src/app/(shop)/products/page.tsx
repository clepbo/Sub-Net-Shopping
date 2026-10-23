import type { Metadata } from "next";
import { categoryFilterIds, findCategory, listCategories } from "@/lib/catalog";
import { storeOptions } from "@/lib/stores-list";
import { ProductBrowser, parseBrowse, type BrowseParams } from "@/components/product-browser";
import { Page, PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "All products" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<BrowseParams> }) {
  const sp = await searchParams;
  const { q, sort, inStockOnly, page } = parseBrowse(sp);
  const [categories, category] = await Promise.all([listCategories(), sp.category ? findCategory(sp.category) : null]);

  return (
    <Page>
      <PageTitle title={q ? `Products matching “${q}”` : "All products"} subtitle="Prices from verified supermarkets in Benin City." />
      <ProductBrowser
        options={{
          q,
          categoryIds: category ? categoryFilterIds(category) : undefined,
          supermarketId: sp.store,
          sort,
          inStockOnly,
          page,
        }}
        params={sp}
        basePath="/products"
        categories={categories.map((c) => ({ value: c.slug, label: c.name }))}
        stores={await storeOptions()}
        emptyHint={q ? "Try a shorter search or a different spelling." : "Supermarkets are adding their products. Check back soon."}
      />
    </Page>
  );
}
