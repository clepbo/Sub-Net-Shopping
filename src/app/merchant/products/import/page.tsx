import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { db } from "@/lib/db";
import { requireMerchantStore } from "@/lib/supermarkets";
import { listCategories } from "@/lib/catalog";
import { MAX_IMPORT_ROWS } from "@/lib/csv-import";
import { formatDateTime } from "@/lib/time";
import { CsvImportForm } from "@/components/forms/product-forms";
import { Badge, Card, Notice, Page, PageTitle, SectionTitle, buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Import products" };

// Large imports make many database round-trips; allow more than the default time on Vercel.
export const maxDuration = 300;

const COLUMNS: [string, string][] = [
  ["sku", "Required. Your product code. Rows with an SKU you already use update that product."],
  ["name", "Required. Product name."],
  ["price", "Required. Selling price in naira, e.g. 1500 or 1,250.50."],
  ["stock", "Optional. Quantity in stock; leave blank if you don't track it."],
  ["barcode", "Optional. Matches the product to the same item at other stores."],
  ["category", "Optional. One of the category names below."],
  ["brand, unit, description", "Optional."],
];

export default async function ImportPage() {
  const { store } = await requireMerchantStore();
  const [runs, categories] = await Promise.all([
    db.posSyncRun.findMany({ where: { supermarketId: store.id }, orderBy: { startedAt: "desc" }, take: 5 }),
    listCategories(),
  ]);

  return (
    <Page>
      <Link href="/merchant/products" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Products
      </Link>
      <PageTitle
        title="Import products from a spreadsheet"
        subtitle="Export your product list from your POS or Excel as CSV and upload it here, instead of typing everything in again."
      />
      {store.status === "SUSPENDED" ? (
        <Notice tone="red" title="This supermarket is suspended" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
          <Card className="space-y-4">
            <SectionTitle>Upload</SectionTitle>
            <a href="/merchant/products/import/template" download className={buttonClass("secondary", "sm")}>
              <Download className="h-4 w-4" aria-hidden /> Download template
            </a>
            <CsvImportForm />
            <p className="text-xs text-gray-500">Up to {MAX_IMPORT_ROWS} rows and 2 MB per file. Add photos afterwards from each product&apos;s page.</p>
          </Card>
          <Card>
            <SectionTitle>Columns</SectionTitle>
            <dl className="space-y-2 text-sm">
              {COLUMNS.map(([k, v]) => (
                <div key={k}>
                  <dt className="font-mono text-xs font-bold text-brand-800">{k}</dt>
                  <dd className="text-gray-600">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-gray-500">Common POS headings like “Product Code”, “Selling Price”, “Qty” and “EAN” are recognised too.</p>
            <p className="mt-3 text-xs font-bold text-gray-700">Categories</p>
            <p className="text-xs text-gray-500">{categories.flatMap((c) => [c.name, ...c.children.map((s) => s.name)]).join(" · ")}</p>
          </Card>
        </div>
      )}
      {runs.length > 0 && (
        <Card>
          <SectionTitle>Recent imports</SectionTitle>
          <ul className="divide-y divide-gray-100 text-sm">
            {runs.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  {formatDateTime(r.startedAt)} · {r.provider === "csv" ? "CSV" : r.provider}
                  <span className="block text-xs text-gray-500">
                    {r.itemsUpdated} of {r.itemsSeen} products saved{r.error ? ` · ${r.error}` : ""}
                  </span>
                </span>
                <Badge tone={r.status === "SUCCEEDED" ? "green" : r.status === "FAILED" ? "red" : "yellow"}>{r.status.toLowerCase()}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </Page>
  );
}
