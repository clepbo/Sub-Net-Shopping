import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireMerchantStore } from "@/lib/supermarkets";
import { getStoreListing, MAX_PRODUCT_IMAGES } from "@/lib/merchant-products";
import { koboToNairaInput, listingStatusOf } from "@/lib/inventory";
import { categoryOptions } from "@/lib/category-options";
import { formatDateTime } from "@/lib/time";
import { DeleteListingButton, EditListingForm, ProductDetailsForm, ProductImagesManager } from "@/components/forms/product-forms";
import { Card, DefinitionList, Notice, Page, PageTitle, SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Edit product" };

const SOURCE_LABEL = { MANUAL: "Edited here", CSV_IMPORT: "CSV import", POS_SYNC: "POS sync" } as const;

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; imageError?: string }>;
}) {
  const { store } = await requireMerchantStore();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const listing = await getStoreListing(store.id, id);
  if (!listing) notFound();
  const { product } = listing;
  const editable = store.status !== "SUSPENDED";
  const ownsProduct = product.createdBySupermarketId === store.id;

  return (
    <Page>
      <Link href="/merchant/products" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Products
      </Link>
      <PageTitle
        title={product.name}
        subtitle={[product.brand, product.unit, product.category?.name].filter(Boolean).join(" · ")}
        action={
          store.status === "APPROVED" &&
          listing.availability !== "UNAVAILABLE" && (
            <Link href={`/products/${product.id}`} className="flex shrink-0 items-center gap-1 text-xs font-bold text-brand-700">
              Customer view <ExternalLink className="h-3 w-3" aria-hidden />
            </Link>
          )
        }
      />
      {sp.created && <Notice tone="green" title="Product added to your store" />}
      {sp.imageError && (
        <Notice tone="yellow" title="Product added, but the images weren't saved">
          {sp.imageError}
        </Notice>
      )}

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <div className="space-y-5">
          <Card>
            <SectionTitle>Price &amp; stock</SectionTitle>
            {editable ? (
              <EditListingForm
                inventoryId={listing.id}
                defaults={{
                  sku: listing.sku,
                  price: koboToNairaInput(listing.priceKobo),
                  stockQuantity: listing.stockQuantity?.toString() ?? "",
                  status: listingStatusOf(listing.availability),
                }}
              />
            ) : (
              <p className="text-sm text-gray-500">This supermarket is suspended.</p>
            )}
            <p className="mt-3 text-xs text-gray-500">
              Last updated {formatDateTime(listing.updatedAt)} · {SOURCE_LABEL[listing.source]}
            </p>
          </Card>
          <Card>
            <SectionTitle>
              Photos ({product.images.length}/{MAX_PRODUCT_IMAGES})
            </SectionTitle>
            <ProductImagesManager
              inventoryId={listing.id}
              canAdd={editable && product.images.length < MAX_PRODUCT_IMAGES}
              images={product.images.map((img) => ({ id: img.id, url: img.url, mine: img.supermarketId === store.id }))}
            />
          </Card>
        </div>

        <Card>
          <SectionTitle>Product details</SectionTitle>
          {ownsProduct && editable ? (
            <>
              {product._count.inventory > 1 && (
                <p className="mb-4 text-xs text-gray-500">
                  {product._count.inventory - 1} other supermarket{product._count.inventory === 2 ? " sells" : "s sell"} this product, so changes here show for them too.
                </p>
              )}
              <ProductDetailsForm
                inventoryId={listing.id}
                categories={await categoryOptions()}
                defaults={{
                  name: product.name,
                  brand: product.brand,
                  unit: product.unit,
                  barcode: product.barcode,
                  categoryId: product.categoryId,
                  description: product.description,
                  isBulky: product.isBulky,
                }}
              />
            </>
          ) : (
            <>
              <DefinitionList
                items={[
                  ["Name", product.name],
                  ["Brand", product.brand],
                  ["Size / pack", product.unit],
                  ["Barcode", product.barcode],
                  ["Category", product.category?.name],
                  ["Bulky item", product.isBulky ? "Yes" : "No"],
                ]}
              />
              {product.description && <p className="mt-3 text-sm text-gray-700">{product.description}</p>}
              {!ownsProduct && <p className="mt-3 text-xs text-gray-500">Another supermarket created this catalogue entry, so only it can change these details.</p>}
            </>
          )}
        </Card>
      </div>

      {editable && <DeleteListingButton inventoryId={listing.id} name={product.name} />}
    </Page>
  );
}
