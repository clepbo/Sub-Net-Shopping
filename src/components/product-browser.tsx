import { PackageSearch } from "lucide-react";
import { browseProducts, SORTS, type BrowseOptions, type Sort } from "@/lib/catalog";
import { Pagination } from "./pagination";
import { ProductFilters } from "./product-filters";
import { ProductGridList } from "./product-card";
import { EmptyState } from "./ui";

export type BrowseParams = { q?: string; sort?: string; instock?: string; page?: string; category?: string; store?: string };

const PAGE_SIZE = 24;

export function parseBrowse(sp: BrowseParams) {
  return {
    q: (sp.q ?? "").trim().slice(0, 80),
    sort: (sp.sort && sp.sort in SORTS ? sp.sort : "relevance") as Sort,
    inStockOnly: sp.instock === "1",
    page: Math.max(1, Math.min(500, Number.parseInt(sp.page ?? "1", 10) || 1)),
  };
}

/** Filter bar, product grid and pagination for any product listing. */
export async function ProductBrowser({
  options,
  params,
  basePath,
  categories,
  stores,
  storeContext,
  emptyTitle = "No products found",
  emptyHint,
}: {
  options: BrowseOptions;
  params: BrowseParams;
  basePath: string;
  categories?: { value: string; label: string }[];
  stores?: { value: string; label: string }[];
  storeContext?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
}) {
  const { items, total } = await browseProducts({ ...options, pageSize: PAGE_SIZE });
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-sm text-gray-600">
          {total} product{total === 1 ? "" : "s"}
        </p>
        <ProductFilters
          sorts={Object.entries(SORTS).map(([value, label]) => ({ value, label }))}
          categories={categories}
          stores={stores}
        />
      </div>
      {items.length === 0 ? (
        <EmptyState icon={<PackageSearch className="h-8 w-8" />} title={emptyTitle}>
          {emptyHint}
        </EmptyState>
      ) : (
        <ProductGridList products={items} storeContext={storeContext} />
      )}
      <Pagination page={options.page ?? 1} pageSize={PAGE_SIZE} total={total} basePath={basePath} params={{ ...params, page: undefined }} />
    </div>
  );
}
