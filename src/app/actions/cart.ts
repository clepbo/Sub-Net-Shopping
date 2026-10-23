"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { VISIBLE_AVAILABILITY } from "@/lib/inventory";
import { MAX_CART_LINES, MAX_ITEM_QUANTITY } from "@/lib/order-rules";
import type { ActionState } from "@/lib/action-state";

function parseQuantity(value: FormDataEntryValue | null) {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(n) ? n : NaN;
}

export async function addToCart(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const current = await getCurrentUser();
  // Guests sign in first and come back to what they were looking at.
  if (!current) redirect(`/login?next=${encodeURIComponent(String(formData.get("returnTo") ?? "/cart"))}`);
  const user = await requireUser("CUSTOMER");
  const inventoryId = String(formData.get("inventoryId") ?? "");
  const quantity = parseQuantity(formData.get("quantity") ?? "1");
  if (!(quantity >= 1 && quantity <= MAX_ITEM_QUANTITY)) return { error: `Choose 1 to ${MAX_ITEM_QUANTITY}` };

  const listing = await db.inventory.findFirst({
    where: { id: inventoryId, availability: { in: VISIBLE_AVAILABILITY }, supermarket: { status: "APPROVED" } },
    select: { id: true, availability: true, stockQuantity: true },
  });
  if (!listing || listing.availability === "OUT_OF_STOCK") return { error: "This item is out of stock" };

  const existing = await db.cartItem.findUnique({ where: { userId_inventoryId: { userId: user.id, inventoryId } } });
  const total = Math.min(MAX_ITEM_QUANTITY, (existing?.quantity ?? 0) + quantity);
  if (listing.stockQuantity !== null && total > listing.stockQuantity) {
    return { error: listing.stockQuantity === 0 ? "This item is out of stock" : `Only ${listing.stockQuantity} available` };
  }
  if (!existing && (await db.cartItem.count({ where: { userId: user.id } })) >= MAX_CART_LINES) {
    return { error: "Your cart is full. Check out or remove some items first." };
  }
  await db.cartItem.upsert({
    where: { userId_inventoryId: { userId: user.id, inventoryId } },
    create: { userId: user.id, inventoryId, quantity: total },
    update: { quantity: total },
  });
  revalidatePath("/", "layout");
  return { ok: existing ? `Cart updated: ${total} in cart` : "Added to cart" };
}

export async function setCartQuantity(formData: FormData) {
  const user = await requireUser("CUSTOMER");
  const id = String(formData.get("cartItemId") ?? "");
  const quantity = parseQuantity(formData.get("quantity"));
  if (Number.isNaN(quantity)) return;
  if (quantity <= 0) await db.cartItem.deleteMany({ where: { id, userId: user.id } });
  else await db.cartItem.updateMany({ where: { id, userId: user.id }, data: { quantity: Math.min(quantity, MAX_ITEM_QUANTITY) } });
  revalidatePath("/", "layout");
}

export async function removeFromCart(formData: FormData) {
  const user = await requireUser("CUSTOMER");
  await db.cartItem.deleteMany({ where: { id: String(formData.get("cartItemId") ?? ""), userId: user.id } });
  revalidatePath("/", "layout");
}
