"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { cartOwner, ownerWhere } from "@/lib/cart-owner";
import { VISIBLE_AVAILABILITY } from "@/lib/inventory";
import { MAX_CART_LINES, MAX_ITEM_QUANTITY } from "@/lib/order-rules";
import type { ActionState } from "@/lib/action-state";

function parseQuantity(value: FormDataEntryValue | null) {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(n) ? n : NaN;
}

const NOT_A_SHOPPER = "Carts are for shoppers. Sign out and shop as a guest, or use a shopper account.";

export async function addToCart(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // Guests get a cart too; they create an account only at checkout.
  const owner = await cartOwner({ create: true });
  if (owner === "not-a-shopper") return { error: NOT_A_SHOPPER };
  if (!owner) return { error: "Please try again" };
  const where = ownerWhere(owner);
  const inventoryId = String(formData.get("inventoryId") ?? "");
  const quantity = parseQuantity(formData.get("quantity") ?? "1");
  if (!(quantity >= 1 && quantity <= MAX_ITEM_QUANTITY)) return { error: `Choose 1 to ${MAX_ITEM_QUANTITY}` };

  const listing = await db.inventory.findFirst({
    where: { id: inventoryId, availability: { in: VISIBLE_AVAILABILITY }, supermarket: { status: "APPROVED" } },
    select: { id: true, availability: true, stockQuantity: true },
  });
  if (!listing || listing.availability === "OUT_OF_STOCK") return { error: "This item is out of stock" };

  const existing = await db.cartItem.findFirst({ where: { ...where, inventoryId } });
  const total = Math.min(MAX_ITEM_QUANTITY, (existing?.quantity ?? 0) + quantity);
  if (listing.stockQuantity !== null && total > listing.stockQuantity) {
    return { error: listing.stockQuantity === 0 ? "This item is out of stock" : `Only ${listing.stockQuantity} available` };
  }
  if (!existing && (await db.cartItem.count({ where })) >= MAX_CART_LINES) {
    return { error: "Your cart is full. Check out or remove some items first." };
  }
  try {
    if (existing) await db.cartItem.update({ where: { id: existing.id }, data: { quantity: total } });
    else await db.cartItem.create({ data: { ...where, inventoryId, quantity: total } });
  } catch (err) {
    // A double tap raced the first add: just bump the quantity.
    if ((err as { code?: string }).code !== "P2002") throw err;
    await db.cartItem.updateMany({ where: { ...where, inventoryId }, data: { quantity: total } });
  }
  revalidatePath("/", "layout");
  return { ok: existing ? `Cart updated: ${total} in cart` : "Added to cart" };
}

async function currentCart() {
  const owner = await cartOwner();
  return owner && owner !== "not-a-shopper" ? ownerWhere(owner) : null;
}

export async function setCartQuantity(formData: FormData) {
  const where = await currentCart();
  if (!where) return;
  const id = String(formData.get("cartItemId") ?? "");
  const quantity = parseQuantity(formData.get("quantity"));
  if (Number.isNaN(quantity)) return;
  if (quantity <= 0) await db.cartItem.deleteMany({ where: { id, ...where } });
  else await db.cartItem.updateMany({ where: { id, ...where }, data: { quantity: Math.min(quantity, MAX_ITEM_QUANTITY) } });
  revalidatePath("/", "layout");
}

export async function removeFromCart(formData: FormData) {
  const where = await currentCart();
  if (!where) return;
  await db.cartItem.deleteMany({ where: { id: String(formData.get("cartItemId") ?? ""), ...where } });
  revalidatePath("/", "layout");
}

/** Adds every in-stock item from a shopping list at one store (one of each). */
export async function addListToCart(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await cartOwner({ create: true });
  if (owner === "not-a-shopper") return { error: NOT_A_SHOPPER };
  if (!owner) return { error: "Please try again" };
  const where = ownerWhere(owner);
  const ids = formData.getAll("inventoryId").map(String).slice(0, MAX_CART_LINES);
  const listings = await db.inventory.findMany({
    where: {
      id: { in: ids },
      supermarketId: String(formData.get("supermarketId") ?? ""),
      availability: { in: ["IN_STOCK", "LOW_STOCK"] },
      supermarket: { status: "APPROVED" },
    },
    select: { id: true, stockQuantity: true },
  });
  const usable = listings.filter((l) => l.stockQuantity === null || l.stockQuantity > 0);
  if (!usable.length) return { error: "These items have just gone out of stock" };
  const existing = await db.cartItem.findMany({ where, select: { inventoryId: true } });
  const have = new Set(existing.map((e) => e.inventoryId));
  const toAdd = usable.filter((l) => !have.has(l.id));
  if (existing.length + toAdd.length > MAX_CART_LINES) return { error: "Your cart is too full for the whole list. Check out or remove some items first." };
  if (toAdd.length) await db.cartItem.createMany({ data: toAdd.map((l) => ({ ...where, inventoryId: l.id, quantity: 1 })), skipDuplicates: true });
  revalidatePath("/", "layout");
  redirect("/cart");
}
