/* eslint-disable @next/next/no-img-element -- product images come from runtime uploads */
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { ArrowLeft, ImageOff, Search } from "lucide-react";
import { db } from "@/lib/db";
import { requireMerchantStore } from "@/lib/supermarkets";
import { searchCatalogForStore } from "@/lib/merchant-products";
import { categoryOptions } from "@/lib/category-options";
import { CreateListingForm } from "@/components/forms/product-forms";
import { Card, LinkButton, Notice, Page, PageTitle, SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Add product" };

type SP = { q?: string; product?: string; mode?: string };

export default async function NewProductPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { store } = await requireMerchantStore();
  const sp = await searchParams;
  const back = (
    <Link href="/merchant/products" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
      <ArrowLeft className="h-4 w-4" aria-hidden /> Products
    </Link>
  );
  if (store.status === "SUSPENDED") {
    return (
      <Page>
        {back}
        <Notice tone="red" title="This supermarket is suspended" />
      </Page>
    );
  }

  // Step 2a: sell an existing catalogue product.
  if (sp.product) {
    const product = await db.product.findFirst({
      where: { id: sp.product, inventory: { none: { supermarketId: store.id } } },
      include: { images: { take: 1, orderBy: { sortOrder: "asc" } }, category: true },
    });
    if (product) {
      return (
        <Page>
          {back}
          <PageTitle title="Sell this product" subtitle="Set your own SKU, price and stock. Shoppers will see your price next to other stores'." />
          <Card className="flex items-center gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-100">
              {product.images[0] ? <img src={product.images[0].url} alt="" className="h-full w-full object-contain" /> : <ImageOff className="h-5 w-5 text-gray-300" aria-hidden />}
            </div>
            <div className="min-w-0">
              <p className="font-bold">{product.name}</p>
              <p className="text-xs text-gray-500">{[product.brand, product.unit, product.category?.name].filter(Boolean).join(" · ")}</p>
            </div>
          </Card>
          <Card>
            <CreateListingForm productId={product.id} categories={[]} />
          </Card>
        </Page>
      );
    }
  }

  // Step 2b: a brand-new catalogue product.
  if (sp.mode === "new") {
    return (
      <Page>
        {back}
        <PageTitle title="Add a new product" />
        <Card>
          <CreateListingForm categories={await categoryOptions()} />
        </Card>
      </Page>
    );
  }

  // Step 1: look for the product in the shared catalogue first.
  const q = (sp.q ?? "").trim().slice(0, 80);
  const matches = await searchCatalogForStore(store.id, q);
  return (
    <Page>
      {back}
      <PageTitle title="Add a product" subtitle="Check whether it's already in the Sub Net catalogue, so shoppers can compare your price with other stores." />
      <Card className="space-y-4">
        <Form action="/merchant/products/new" className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
            <input
              name="q"
              type="search"
              defaultValue={q}
              autoFocus
              placeholder="Product name, brand or barcode"
              aria-label="Search the catalogue"
              className="h-11 w-full rounded-xl border border-gray-300 pr-3 pl-9"
            />
          </div>
          <button className="h-11 rounded-xl bg-brand-700 px-4 text-sm font-bold text-white">Search</button>
        </Form>
        {q && (
          <div>
            <SectionTitle>{matches.length ? "Already in the catalogue" : "No catalogue matches"}</SectionTitle>
            {matches.length > 0 && (
              <ul className="divide-y divide-gray-100">
                {matches.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100">
                      {p.images[0] ? <img src={p.images[0].url} alt="" className="h-full w-full object-contain" /> : <ImageOff className="h-4 w-4 text-gray-300" aria-hidden />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{p.name}</p>
                      <p className="truncate text-xs text-gray-500">
                        {[p.brand, p.unit, p.category?.name].filter(Boolean).join(" · ")} · sold by {p._count.inventory} store
                        {p._count.inventory === 1 ? "" : "s"}
                      </p>
                    </div>
                    <LinkButton href={`/merchant/products/new?product=${p.id}`} size="sm" variant="secondary">
                      Sell this
                    </LinkButton>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>
      <Card className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-bold">Not in the catalogue?</p>
          <p className="text-sm text-gray-600">Create it with a name, category and photos.</p>
        </div>
        <LinkButton href="/merchant/products/new?mode=new">Create a new product</LinkButton>
      </Card>
    </Page>
  );
}
