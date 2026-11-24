import "server-only";
// Whose cart this request is using: the signed-in customer's, or a guest's.
// Guests are identified by a random, httpOnly cookie. When a guest signs up
// or signs in, their cart moves into the account (mergeGuestCart), so they
// carry on exactly where they left off.
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import { getCurrentUser } from "./auth";
import { MAX_CART_LINES, MAX_ITEM_QUANTITY } from "./order-rules";

export const GUEST_CART_COOKIE = "sns_cart";
const GUEST_CART_DAYS = 30;

export type CartOwner = { userId: string; guestId?: undefined } | { guestId: string; userId?: undefined };

/** Prisma filter for an owner's cart lines. */
export const ownerWhere = (o: CartOwner) => (o.userId ? { userId: o.userId } : { guestId: o.guestId! });

async function readGuestId() {
  const v = (await cookies()).get(GUEST_CART_COOKIE)?.value;
  return v && /^[A-Za-z0-9_-]{32,64}$/.test(v) ? v : null;
}

/**
 * The cart owner for this request. Signed-in shoppers use their account;
 * guests use their cookie (created when `create` is set, which only works in
 * server actions and route handlers). Staff, riders and admins have no cart.
 */
export async function cartOwner(opts: { create?: boolean } = {}): Promise<CartOwner | "not-a-shopper" | null> {
  const user = await getCurrentUser();
  if (user && user.status === "ACTIVE") return user.role === "CUSTOMER" ? { userId: user.id } : "not-a-shopper";
  const existing = await readGuestId();
  if (existing) return { guestId: existing };
  if (!opts.create) return null;
  const guestId = randomBytes(32).toString("base64url");
  (await cookies()).set(GUEST_CART_COOKIE, guestId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GUEST_CART_DAYS * 24 * 3600,
  });
  return { guestId };
}

/**
 * Moves this browser's guest cart into the customer's account: quantities of
 * items already in the account are added together (capped), and the guest
 * cookie is cleared. Safe to call when there's no guest cart.
 */
export async function mergeGuestCart(userId: string) {
  const guestId = await readGuestId();
  if (!guestId) return 0;
  const moved = await moveGuestCart(guestId, userId);
  (await cookies()).delete(GUEST_CART_COOKIE);
  return moved;
}

/** Moves a guest cart's lines onto an account (see mergeGuestCart). */
export async function moveGuestCart(guestId: string, userId: string) {
  return db.$transaction(async (tx) => {
    const guestItems = await tx.cartItem.findMany({ where: { guestId }, orderBy: { createdAt: "asc" } });
    const mine = await tx.cartItem.findMany({ where: { userId }, select: { id: true, inventoryId: true, quantity: true } });
    let lines = mine.length;
    let count = 0;
    for (const g of guestItems) {
      const same = mine.find((m) => m.inventoryId === g.inventoryId);
      if (same) {
        await tx.cartItem.update({ where: { id: same.id }, data: { quantity: Math.min(MAX_ITEM_QUANTITY, same.quantity + g.quantity) } });
        await tx.cartItem.delete({ where: { id: g.id } });
      } else if (lines < MAX_CART_LINES) {
        await tx.cartItem.update({ where: { id: g.id }, data: { userId, guestId: null } });
        lines++;
      } else {
        await tx.cartItem.delete({ where: { id: g.id } });
        continue;
      }
      count++;
    }
    return count;
  });
}

/** Forgets guest carts nobody has touched for a month (background jobs). */
export async function pruneGuestCarts(now = new Date()) {
  const r = await db.cartItem.deleteMany({ where: { userId: null, updatedAt: { lt: new Date(now.getTime() - GUEST_CART_DAYS * 24 * 3600_000) } } });
  return r.count;
}
