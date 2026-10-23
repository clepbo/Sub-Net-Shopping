"use client";

/* eslint-disable @next/next/no-img-element -- product images come from runtime uploads */
import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import {
  createListing,
  deleteListing,
  deleteProductImage,
  importProductsCsv,
  quickUpdateListing,
  updateListing,
  updateProductDetails,
  uploadProductImages,
  type ImportResult,
} from "@/app/actions/products";
import type { ActionState } from "@/lib/action-state";
import { Field, FormMessage, Select, SubmitButton, TextArea } from "../form";
import { buttonClass, cx } from "../ui";

export type CategoryOption = { value: string; label: string };

const STATUS_OPTIONS = [
  { value: "AVAILABLE", label: "Available" },
  { value: "OUT_OF_STOCK", label: "Out of stock" },
  { value: "HIDDEN", label: "Hidden from customers" },
];

type ListingDefaults = { sku: string; price: string; stockQuantity: string; status: string };

function ListingFields({ state, defaults }: { state: ActionState; defaults?: ListingDefaults }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Your SKU / product code" name="sku" defaultValue={defaults?.sku} state={state} hint="The code your till or POS uses" />
      <Field label="Price (₦)" name="price" inputMode="decimal" placeholder="e.g. 1500" defaultValue={defaults?.price} state={state} />
      <Field
        label="Stock quantity"
        name="stockQuantity"
        inputMode="numeric"
        defaultValue={defaults?.stockQuantity}
        state={state}
        hint="Optional. 5 or fewer shows as “Low stock”, 0 as “Out of stock”."
      />
      <Select label="Status" name="status" options={STATUS_OPTIONS} defaultValue={defaults?.status ?? "AVAILABLE"} state={state} />
    </div>
  );
}

type DetailsDefaults = {
  name: string;
  brand: string | null;
  unit: string | null;
  barcode: string | null;
  categoryId: string | null;
  description: string | null;
  isBulky: boolean;
};

function DetailsFields({ state, categories, defaults }: { state: ActionState; categories: CategoryOption[]; defaults?: DetailsDefaults }) {
  const bulkyChecked = state.values ? state.values.isBulky === "on" : (defaults?.isBulky ?? false);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Product name" name="name" defaultValue={defaults?.name} state={state} className="sm:col-span-2" placeholder="e.g. Indomie Chicken Noodles" />
      <Field label="Brand" name="brand" defaultValue={defaults?.brand ?? ""} state={state} />
      <Field label="Size / pack" name="unit" defaultValue={defaults?.unit ?? ""} placeholder="e.g. 70g, 1 kg, 50cl, x30" state={state} />
      <Field
        label="Barcode"
        name="barcode"
        inputMode="numeric"
        defaultValue={defaults?.barcode ?? ""}
        state={state}
        hint="Optional. Lets shoppers compare your price with other stores."
      />
      <Select
        label="Category"
        name="categoryId"
        options={[{ value: "", label: "Choose a category" }, ...categories]}
        defaultValue={defaults?.categoryId ?? ""}
        state={state}
      />
      <TextArea label="Description" name="description" defaultValue={defaults?.description ?? ""} state={state} className="sm:col-span-2" />
      <label className="flex items-center gap-2 text-sm font-medium text-gray-800 sm:col-span-2">
        <input type="checkbox" name="isBulky" defaultChecked={bulkyChecked} key={String(bulkyChecked)} className="h-5 w-5 accent-brand-700" />
        Bulky item (needs a car, van or truck to deliver, e.g. a TV or fridge)
      </label>
    </div>
  );
}

function ImagesInput() {
  return (
    <div>
      <label htmlFor="images" className="mb-1 block text-sm font-semibold text-gray-800">
        Images
      </label>
      <input
        id="images"
        type="file"
        name="images"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-semibold file:text-brand-800"
      />
      <p className="mt-1 text-xs text-gray-500">JPG, PNG or WebP, up to 2 MB each. A plain white background works best.</p>
    </div>
  );
}

/** New listing: either for an existing catalogue product, or a brand-new product. */
export function CreateListingForm({ productId, categories }: { productId?: string; categories: CategoryOption[] }) {
  const [state, action] = useActionState(createListing, {});
  return (
    <form action={action} className="space-y-6" noValidate>
      <FormMessage state={state} />
      {productId ? (
        <input type="hidden" name="productId" value={productId} />
      ) : (
        <section className="space-y-4">
          <h2 className="text-xs font-bold tracking-wider text-gray-600 uppercase">Product details</h2>
          <DetailsFields state={state} categories={categories} />
          <ImagesInput />
        </section>
      )}
      <section className="space-y-4">
        <h2 className="text-xs font-bold tracking-wider text-gray-600 uppercase">Your price &amp; stock</h2>
        <ListingFields state={state} />
      </section>
      <SubmitButton pendingText="Adding…">Add to my store</SubmitButton>
    </form>
  );
}

export function EditListingForm({ inventoryId, defaults }: { inventoryId: string; defaults: ListingDefaults }) {
  const [state, action] = useActionState(updateListing, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="inventoryId" value={inventoryId} />
      <ListingFields state={state} defaults={defaults} />
      <SubmitButton>Save price &amp; stock</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function ProductDetailsForm({ inventoryId, categories, defaults }: { inventoryId: string; categories: CategoryOption[]; defaults: DetailsDefaults }) {
  const [state, action] = useActionState(updateProductDetails, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="inventoryId" value={inventoryId} />
      <DetailsFields state={state} categories={categories} defaults={defaults} />
      <SubmitButton variant="secondary">Save details</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function ProductImagesManager({
  inventoryId,
  images,
  canAdd,
}: {
  inventoryId: string;
  images: { id: string; url: string; mine: boolean }[];
  canAdd: boolean;
}) {
  const [state, action] = useActionState(uploadProductImages, {});
  return (
    <div className="space-y-4">
      {images.length > 0 ? (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((img) => (
            <li key={img.id} className="relative aspect-square overflow-hidden rounded-xl border border-gray-200 bg-white p-1">
              <img src={img.url} alt="" className="h-full w-full object-contain" />
              {img.mine && (
                <form action={deleteProductImage} className="absolute top-1 right-1">
                  <input type="hidden" name="imageId" value={img.id} />
                  <input type="hidden" name="inventoryId" value={inventoryId} />
                  <button className="rounded-lg bg-white/90 p-1.5 text-red-600 shadow hover:bg-white" aria-label="Remove image">
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">No images yet. Products with a clear photo get far more attention.</p>
      )}
      {canAdd && (
        <form action={action} className="space-y-3">
          <input type="hidden" name="inventoryId" value={inventoryId} />
          <ImagesInput />
          <SubmitButton variant="secondary" size="sm" pendingText="Uploading…">
            Upload images
          </SubmitButton>
          <FormMessage state={state} />
        </form>
      )}
    </div>
  );
}

export function DeleteListingButton({ inventoryId, name }: { inventoryId: string; name: string }) {
  return (
    <form
      action={deleteListing}
      onSubmit={(e) => {
        if (!confirm(`Remove “${name}” from your store? Customers will no longer see it.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="inventoryId" value={inventoryId} />
      <button className={cx(buttonClass("secondary", "sm"), "text-red-700")}>
        <Trash2 className="h-4 w-4" aria-hidden /> Remove from my store
      </button>
    </form>
  );
}

/** Price and stock editing inline in the products table. */
export function QuickEdit({ inventoryId, price, stockQuantity, label }: { inventoryId: string; price: string; stockQuantity: string; label: string }) {
  const [state, action] = useActionState(quickUpdateListing, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="inventoryId" value={inventoryId} />
      <label className="flex items-center gap-1 text-xs text-gray-500">
        ₦
        <input
          name="price"
          defaultValue={price}
          inputMode="decimal"
          aria-label={`Price for ${label}`}
          className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
        />
      </label>
      <label className="flex items-center gap-1 text-xs text-gray-500">
        Qty
        <input
          name="stockQuantity"
          defaultValue={stockQuantity}
          inputMode="numeric"
          placeholder="—"
          aria-label={`Stock for ${label}`}
          className="w-16 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
        />
      </label>
      <SubmitButton variant="secondary" size="sm" pendingText="…">
        Save
      </SubmitButton>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
      {state.ok && <span className="text-xs text-brand-700">{state.ok}</span>}
    </form>
  );
}

export function CsvImportForm() {
  const [state, action] = useActionState<ImportResult, FormData>(importProductsCsv, {});
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3">
        <input
          type="file"
          name="file"
          accept=".csv,text/csv"
          aria-label="CSV file"
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-semibold file:text-brand-800"
        />
        <SubmitButton pendingText="Importing…">Import products</SubmitButton>
      </form>
      <FormMessage state={state} />
      {state.rowErrors && state.rowErrors.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-bold">
            {state.rowErrors.length} row{state.rowErrors.length === 1 ? "" : "s"} skipped
            {state.rowErrors.length === 50 ? " (showing the first 50)" : ""}:
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {state.rowErrors.map((e) => (
              <li key={e.line}>
                Line {e.line}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
