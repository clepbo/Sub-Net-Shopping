/* eslint-disable @next/next/no-img-element -- product images come from runtime uploads */
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { ImageOff, Package, Plus, Upload } from "lucide-react";
import { requireMerchantStore } from "@/lib/supermarkets";
import { inventoryCounts, listStoreInventory, MERCHANT_PAGE_SIZE } from "@/lib/merchant-products";
import { AVAILABILITY_LABEL, koboToNairaInput } from "@/lib/inventory";
import { formatNaira } from "@/lib/money";
import type { Availability } from "@/generated/prisma/enums";
import { QuickEdit } from "@/components/forms/product-forms";
import { Pagination } from "@/components/pagination";
import { Badge, EmptyState, LinkButton, Notice, Page, PageTitle, StatTile, type Tone } from "@/components/ui";

export const metadata: Metadata = { title: "Products" };

const AVAILABILITY_TONE: Record<Availability, Tone> = { IN_STOCK: "green", LOW_STOCK: "yellow", OUT_OF_STOCK: "red", UNAVAILABLE: "gray" };
const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "IN_STOCK", label: "In stock" },
  { value: "LOW_STOCK", label: "Low stock" },
  { value: "OUT_OF_STOCK", label: "Out of stock" },
  { value: "UNAVAILABLE", label: "Hidden" },
];

type SP = { q?: string; status?: string; page?: string; removed?: string };

export default async function MerchantProducts({ searchParams }: { searchParams: Promise<SP> }) {
  const { store } = await requireMerchantStore();
  const sp = await searchParams;
  const status = FILTERS.find((f) => f.value && f.value === sp.status)?.value as Availability | undefined;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const [{ items, total }, counts] = await Promise.all([listStoreInventory(store.id, { q, availability: status, page }), inventoryCounts(store.id)]);
  const editable = store.status !== "SUSPENDED";

  return (
    <Page>
      <PageTitle
        eyebrow="Merchant"
        title="Products"
        subtitle="What customers see in your store: prices, stock and photos."
        action={
          editable && (
            <div className="flex gap-2">
              <LinkButton href="/merchant/products/import" variant="secondary" size="sm">
                <Upload className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Import CSV</span>
              </LinkButton>
              <LinkButton href="/merchant/products/new" size="sm">
                <Plus className="h-4 w-4" aria-hidden /> Add product
              </LinkButton>
            </div>
          )
        }
      />
      {sp.removed && <Notice tone="green" title="Product removed from your store" />}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Listed" value={counts.total} />
        <StatTile label="In stock" value={counts.inStock} tone="green" />
        <StatTile label="Low / out" value={counts.lowStock + counts.outOfStock} tone={counts.lowStock + counts.outOfStock ? "yellow" : "gray"} />
        <StatTile label="Hidden" value={counts.hidden} />
      </div>

      {counts.total === 0 ? (
        <EmptyState icon={<Package className="h-8 w-8" />} title="No products yet">
          <p>Add products one at a time, or import them all at once from a spreadsheet exported from your POS.</p>
          {editable && (
            <div className="mt-4 flex justify-center gap-2">
              <LinkButton href="/merchant/products/new" size="sm">
                Add a product
              </LinkButton>
              <LinkButton href="/merchant/products/import" variant="secondary" size="sm">
                Import CSV
              </LinkButton>
            </div>
          )}
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Form action="/merchant/products" className="min-w-0 flex-1">
              {status && <input type="hidden" name="status" value={status} />}
              <input
                name="q"
                type="search"
                defaultValue={q}
                placeholder="Search by name, brand, SKU or barcode"
                aria-label="Search products"
                className="h-10 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm"
              />
            </Form>
            <nav className="flex gap-1 overflow-x-auto" aria-label="Filter by status">
              {FILTERS.map((f) => {
                const active = (status ?? "") === f.value;
                const params = new URLSearchParams({ ...(q ? { q } : {}), ...(f.value ? { status: f.value } : {}) });
                return (
                  <Link
                    key={f.value}
                    href={`/merchant/products${params.size ? `?${params}` : ""}`}
                    aria-current={active ? "page" : undefined}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${active ? "border-brand-700 bg-brand-700 text-white" : "border-gray-300 bg-white text-gray-700"}`}
                  >
                    {f.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {items.length === 0 ? (
            <EmptyState title="No products match" />
          ) : (
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
              {items.map((item) => {
                const image = item.product.images[0]?.url;
                return (
                  <li key={item.id} className="flex flex-col gap-3 p-3 md:flex-row md:items-center">
                    <Link href={`/merchant/products/${item.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-white">
                        {image ? <img src={image} alt="" className="h-full w-full object-contain" /> : <ImageOff className="h-5 w-5 text-gray-300" aria-hidden />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900 hover:text-brand-800">{item.product.name}</p>
                        <p className="truncate text-xs text-gray-500">
                          SKU {item.sku}
                          {item.product.unit && ` · ${item.product.unit}`}
                          {item.product.category && ` · ${item.product.category.name}`}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge tone={AVAILABILITY_TONE[item.availability]}>{AVAILABILITY_LABEL[item.availability]}</Badge>
                          <span className="text-xs font-bold text-gray-700 md:hidden">{formatNaira(item.priceKobo)}</span>
                        </div>
                      </div>
                    </Link>
                    {editable && (
                      <QuickEdit
                        inventoryId={item.id}
                        label={item.product.name}
                        price={koboToNairaInput(item.priceKobo)}
                        stockQuantity={item.stockQuantity?.toString() ?? ""}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <Pagination page={page} pageSize={MERCHANT_PAGE_SIZE} total={total} basePath="/merchant/products" params={{ q: q || undefined, status }} />
        </>
      )}
    </Page>
  );
}
