"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireEditableStore } from "@/lib/supermarkets";
import { logActivity } from "@/lib/activity";
import { deleteStoredFile, storeImage } from "@/lib/storage";
import { deriveAvailability, upsertListing } from "@/lib/inventory";
import { planImport } from "@/lib/csv-import";
import { MAX_PRODUCT_IMAGES } from "@/lib/merchant-products";
import { formValues, type ActionState } from "@/lib/action-state";
import { fieldErrors, listingFields, productDetails, quickListingUpdate } from "@/lib/validation";
import { Prisma } from "@/generated/prisma/client";

function refresh(inventoryId?: string) {
  revalidatePath("/merchant", "layout");
  revalidatePath("/", "layout");
  if (inventoryId) revalidatePath(`/merchant/products/${inventoryId}`);
}

function parseListing(formData: FormData) {
  return listingFields.safeParse({
    sku: formData.get("sku") ?? "",
    priceKobo: formData.get("price") ?? "",
    stockQuantity: formData.get("stockQuantity") ?? "",
    status: formData.get("status") ?? "AVAILABLE",
  });
}

function parseDetails(formData: FormData) {
  return productDetails.safeParse({
    name: formData.get("name") ?? "",
    brand: formData.get("brand") ?? "",
    unit: formData.get("unit") ?? "",
    barcode: formData.get("barcode") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    description: formData.get("description") ?? "",
    isBulky: formData.get("isBulky") === "on",
  });
}

/** Maps zod paths to the form's field names. */
function listingErrors(errors: Record<string, string>) {
  const { priceKobo, stockQuantity, ...rest } = errors;
  return { ...rest, ...(priceKobo ? { price: priceKobo } : {}), ...(stockQuantity ? { stockQuantity } : {}) };
}

function imageFiles(formData: FormData, field = "images") {
  return formData.getAll(field).filter((f): f is File => f instanceof File && f.size > 0);
}

async function saveImages(productId: string, supermarketId: string, files: File[]) {
  const existing = await db.productImage.count({ where: { productId } });
  if (existing + files.length > MAX_PRODUCT_IMAGES) {
    throw new Error(`A product can have up to ${MAX_PRODUCT_IMAGES} images`);
  }
  let order = existing;
  for (const file of files) {
    const stored = await storeImage(file, `products/${productId}`);
    await db.productImage.create({ data: { productId, supermarketId, url: stored.url, storageKey: stored.key, sortOrder: order++ } });
  }
}

/**
 * Lists a product in the merchant's store. With `productId` the store sells
 * an existing catalogue product (so customers can compare prices);
 * otherwise a new catalogue product is created from the details given.
 */
export async function createListing(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, store, blocked } = await requireEditableStore();
  const values = formValues(formData);
  if (blocked) return { error: blocked, values };

  const listing = parseListing(formData);
  const existingProductId = String(formData.get("productId") ?? "") || null;
  const details = existingProductId ? null : parseDetails(formData);
  const errors = {
    ...(listing.success ? {} : listingErrors(fieldErrors(listing.error))),
    ...(details && !details.success ? fieldErrors(details.error) : {}),
  };
  if (!listing.success || (details && !details.success)) return { fieldErrors: errors, values };
  const l = listing.data;
  const files = imageFiles(formData);

  let productId = existingProductId;
  if (productId) {
    const product = await db.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) return { error: "That product no longer exists", values };
  } else {
    const d = details!.data!;
    if (!(await db.category.findUnique({ where: { id: d.categoryId }, select: { id: true } }))) {
      return { fieldErrors: { categoryId: "Choose a category" }, values };
    }
    if (d.barcode) {
      const match = await db.product.findUnique({ where: { barcode: d.barcode }, select: { name: true } });
      if (match) {
        return {
          fieldErrors: { barcode: `This barcode is already in the catalogue as “${match.name}”. Search for it above and sell that product instead.` },
          values,
        };
      }
    }
  }

  if (await db.inventory.findUnique({ where: { supermarketId_sku: { supermarketId: store.id, sku: l.sku } }, select: { id: true } })) {
    return { fieldErrors: { sku: "You already use this SKU for another product" }, values };
  }
  if (productId && (await db.inventory.findUnique({ where: { supermarketId_productId: { supermarketId: store.id, productId } }, select: { id: true } }))) {
    return { error: "You already sell this product. Edit the existing listing instead.", values };
  }

  let inventoryId: string;
  try {
    inventoryId = await db.$transaction(async (tx) => {
      if (!productId) {
        const d = details!.data!;
        productId = (await tx.product.create({ data: { ...d, createdBySupermarketId: store.id } })).id;
      }
      const inv = await tx.inventory.create({
        data: {
          supermarketId: store.id,
          productId,
          sku: l.sku,
          priceKobo: l.priceKobo,
          stockQuantity: l.stockQuantity,
          availability: deriveAvailability(l.status, l.stockQuantity),
        },
      });
      return inv.id;
    });
  } catch (err) {
    // Lost a race with a concurrent save of the same SKU or product.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "This SKU or product was just added to your store. Refresh and try again.", values };
    }
    throw err;
  }

  let imageError: string | null = null;
  if (files.length) {
    try {
      await saveImages(productId!, store.id, files);
    } catch (err) {
      imageError = err instanceof Error ? err.message : "Image upload failed";
    }
  }
  await logActivity({ actorId: user.id, action: "product.listed", targetType: "inventory", targetId: inventoryId, details: l.sku });
  refresh();
  redirect(`/merchant/products/${inventoryId}?${imageError ? `imageError=${encodeURIComponent(imageError)}` : "created=1"}`);
}

export async function updateListing(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, store, blocked } = await requireEditableStore();
  const values = formValues(formData);
  if (blocked) return { error: blocked, values };
  const id = String(formData.get("inventoryId") ?? "");
  const listing = await db.inventory.findFirst({ where: { id, supermarketId: store.id } });
  if (!listing) return { error: "Listing not found" };
  const parsed = parseListing(formData);
  if (!parsed.success) return { fieldErrors: listingErrors(fieldErrors(parsed.error)), values };
  const l = parsed.data;
  const clash = await db.inventory.findUnique({ where: { supermarketId_sku: { supermarketId: store.id, sku: l.sku } }, select: { id: true } });
  if (clash && clash.id !== id) return { fieldErrors: { sku: "You already use this SKU for another product" }, values };
  try {
    await db.inventory.update({
      where: { id },
      data: { sku: l.sku, priceKobo: l.priceKobo, stockQuantity: l.stockQuantity, availability: deriveAvailability(l.status, l.stockQuantity), source: "MANUAL" },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return { fieldErrors: { sku: "You already use this SKU for another product" }, values };
    throw err;
  }
  await logActivity({ actorId: user.id, action: "product.listing_updated", targetType: "inventory", targetId: id, details: l.sku });
  refresh(id);
  return { ok: "Price and stock saved", values };
}

/** Inline price/stock update from the products table. */
export async function quickUpdateListing(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { store, blocked } = await requireEditableStore();
  if (blocked) return { error: blocked };
  const id = String(formData.get("inventoryId") ?? "");
  const listing = await db.inventory.findFirst({ where: { id, supermarketId: store.id } });
  if (!listing) return { error: "Listing not found" };
  const parsed = quickListingUpdate.safeParse({ priceKobo: formData.get("price") ?? "", stockQuantity: formData.get("stockQuantity") ?? "" });
  if (!parsed.success) return { error: Object.values(fieldErrors(parsed.error))[0] };
  const status = listing.availability === "UNAVAILABLE" ? "HIDDEN" : listing.availability === "OUT_OF_STOCK" && listing.stockQuantity === null ? "OUT_OF_STOCK" : "AVAILABLE";
  await db.inventory.update({
    where: { id },
    data: { ...parsed.data, availability: deriveAvailability(status, parsed.data.stockQuantity), source: "MANUAL" },
  });
  refresh();
  return { ok: "Saved" };
}

export async function updateProductDetails(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, store, blocked } = await requireEditableStore();
  const values = formValues(formData);
  if (blocked) return { error: blocked, values };
  const id = String(formData.get("inventoryId") ?? "");
  const listing = await db.inventory.findFirst({ where: { id, supermarketId: store.id }, include: { product: true } });
  if (!listing) return { error: "Listing not found" };
  if (listing.product.createdBySupermarketId !== store.id) {
    return { error: "Another supermarket created this catalogue entry, so only it can change the shared details." };
  }
  const parsed = parseDetails(formData);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  if (!(await db.category.findUnique({ where: { id: parsed.data.categoryId }, select: { id: true } }))) {
    return { fieldErrors: { categoryId: "Choose a category" }, values };
  }
  try {
    await db.product.update({ where: { id: listing.productId }, data: parsed.data });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { fieldErrors: { barcode: "Another catalogue product already has this barcode" }, values };
    }
    throw err;
  }
  await logActivity({ actorId: user.id, action: "product.details_updated", targetType: "product", targetId: listing.productId });
  refresh(id);
  return { ok: "Product details saved", values };
}

export async function uploadProductImages(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { store, blocked } = await requireEditableStore();
  if (blocked) return { error: blocked };
  const id = String(formData.get("inventoryId") ?? "");
  const listing = await db.inventory.findFirst({ where: { id, supermarketId: store.id } });
  if (!listing) return { error: "Listing not found" };
  const files = imageFiles(formData);
  if (!files.length) return { error: "Choose at least one image" };
  try {
    await saveImages(listing.productId, store.id, files);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Upload failed" };
  }
  refresh(id);
  return { ok: files.length === 1 ? "Image added" : `${files.length} images added` };
}

export async function deleteProductImage(formData: FormData) {
  const { store, blocked } = await requireEditableStore();
  if (blocked) return;
  const image = await db.productImage.findFirst({ where: { id: String(formData.get("imageId") ?? ""), supermarketId: store.id } });
  if (!image) return;
  await db.productImage.delete({ where: { id: image.id } });
  await deleteStoredFile(image.url);
  refresh(String(formData.get("inventoryId") ?? ""));
}

/**
 * Removes a listing. If no other store sells the product and this store
 * created it, the catalogue entry and its images go too.
 */
export async function deleteListing(formData: FormData) {
  const { user, store, blocked } = await requireEditableStore();
  if (blocked) return;
  const listing = await db.inventory.findFirst({
    where: { id: String(formData.get("inventoryId") ?? ""), supermarketId: store.id },
    include: { product: { include: { images: true, _count: { select: { inventory: true } } } } },
  });
  if (!listing) redirect("/merchant/products");
  await db.inventory.delete({ where: { id: listing.id } });
  const orphan = listing.product._count.inventory === 1 && listing.product.createdBySupermarketId === store.id;
  if (orphan) {
    await db.product.delete({ where: { id: listing.productId } });
    await Promise.all(listing.product.images.map((img) => deleteStoredFile(img.url)));
  }
  await logActivity({ actorId: user.id, action: "product.unlisted", targetType: "inventory", targetId: listing.id, details: listing.sku });
  refresh();
  redirect("/merchant/products?removed=1");
}

export type ImportResult = ActionState & { created?: number; updated?: number; rowErrors?: { line: number; message: string }[] };

/** Bulk create/update listings from a CSV, e.g. a POS export (PRD §9). */
export async function importProductsCsv(_prev: ImportResult, formData: FormData): Promise<ImportResult> {
  const { user, store, blocked } = await requireEditableStore();
  if (blocked) return { error: blocked };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file to import" };
  if (file.size > 2 * 1024 * 1024) return { error: "CSV files must be 2 MB or smaller" };

  const categories = await db.category.findMany({ select: { id: true, name: true, slug: true } });
  const byName = new Map<string, string>();
  for (const c of categories) {
    byName.set(c.name.toLowerCase(), c.id);
    byName.set(c.slug.toLowerCase(), c.id);
  }
  const plan = planImport(await file.text(), (n) => byName.get(n.trim().toLowerCase()) ?? null);
  if (plan.items.length === 0) return { error: "No products could be imported", rowErrors: plan.errors.slice(0, 50) };

  const run = await db.posSyncRun.create({ data: { supermarketId: store.id, provider: "csv" } });
  let created = 0;
  let updated = 0;
  try {
    for (const item of plan.items) {
      const result = await db.$transaction((tx) => upsertListing(tx, store.id, item, "CSV_IMPORT"));
      if (result === "created") created++;
      else updated++;
    }
  } catch (err) {
    await db.posSyncRun.update({
      where: { id: run.id },
      data: { status: "FAILED", itemsSeen: plan.items.length, itemsUpdated: created + updated, error: String(err), finishedAt: new Date() },
    });
    return { error: `Import stopped after ${created + updated} products: ${err instanceof Error ? err.message : err}`, created, updated };
  }
  await db.posSyncRun.update({
    where: { id: run.id },
    data: { status: "SUCCEEDED", itemsSeen: plan.items.length, itemsUpdated: created + updated, finishedAt: new Date() },
  });
  await logActivity({ actorId: user.id, action: "product.csv_imported", targetType: "supermarket", targetId: store.id, details: `${created} new, ${updated} updated` });
  refresh();
  return { ok: `Imported ${created + updated} products (${created} new, ${updated} updated)`, created, updated, rowErrors: plan.errors.slice(0, 50) };
}
