/* eslint-disable @next/next/no-img-element -- product images come from runtime uploads */
import type { Metadata } from "next";
import Link from "next/link";
import { ImageOff, ShoppingCart, Store } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getCart } from "@/lib/cart";
import { formatNaira } from "@/lib/money";
import { CartQuantity, RemoveFromCart } from "@/components/forms/cart-forms";
import { StoreStateBadge } from "@/components/store-status";
import { Card, EmptyState, LinkButton, Notice, Page, PageTitle, buttonClass, cx } from "@/components/ui";

export const metadata: Metadata = { title: "Cart" };

export default async function CartPage() {
  const user = await requireUser("CUSTOMER");
  const groups = await getCart(user.id);

  if (groups.length === 0) {
    return (
      <Page>
        <PageTitle title="Your cart" />
        <EmptyState icon={<ShoppingCart className="h-8 w-8" />} title="Your cart is empty">
          <p>Find products and compare prices across supermarkets.</p>
          <LinkButton href="/products" size="sm" className="mt-4">
            Browse products
          </LinkButton>
        </EmptyState>
      </Page>
    );
  }

  return (
    <Page>
      <PageTitle
        title="Your cart"
        subtitle={groups.length > 1 ? `Items from ${groups.length} supermarkets. Each supermarket is a separate order.` : "Reserve & Pick Up, pay at the store."}
      />
      <div className="space-y-5">
        {groups.map((g) => (
          <Card key={g.supermarket.id} className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <Link href={`/stores/${g.supermarket.id}`} className="flex items-center gap-2">
                <Store className="h-5 w-5 text-brand-700" aria-hidden />
                <span>
                  <span className="block font-extrabold">{g.supermarket.name}</span>
                  <span className="text-xs text-gray-500">{g.supermarket.area ?? g.supermarket.address}</span>
                </span>
              </Link>
              <StoreStateBadge availability={g.availability} />
            </div>
            <ul className="divide-y divide-gray-100">
              {g.lines.map((l) => (
                <li key={l.id} className={cx("flex gap-3 py-3", l.issue && "rounded-xl bg-red-50 px-2")}>
                  <Link href={`/products/${l.productId}`} className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-white">
                    {l.image ? <img src={l.image} alt="" className="h-full w-full object-contain" /> : <ImageOff className="h-5 w-5 text-gray-300" aria-hidden />}
                  </Link>
                  <div className="min-w-0 flex-1 space-y-1">
                    <Link href={`/products/${l.productId}`} className="line-clamp-2 text-sm font-semibold hover:text-brand-800">
                      {l.name}
                    </Link>
                    <p className="text-xs text-gray-500">
                      {l.unit && `${l.unit} · `}
                      {formatNaira(l.unitPriceKobo)} each
                    </p>
                    {l.issue && <p className="text-xs font-bold text-red-700">{l.issue}</p>}
                    <div className="flex items-center justify-between gap-2">
                      <CartQuantity cartItemId={l.id} quantity={l.quantity} name={l.name} />
                      <RemoveFromCart cartItemId={l.id} name={l.name} />
                    </div>
                  </div>
                  <p className="font-bold tabular-nums">{formatNaira(l.lineTotalKobo)}</p>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-3 border-t border-gray-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm">
                Subtotal <span className="text-lg font-extrabold">{formatNaira(g.subtotalKobo)}</span>
              </p>
              {g.blocker ? (
                <span className={cx(buttonClass("secondary"), "pointer-events-none opacity-60")} aria-disabled>
                  Checkout unavailable
                </span>
              ) : (
                <LinkButton href={`/checkout/${g.supermarket.id}`}>Checkout at {g.supermarket.name}</LinkButton>
              )}
            </div>
            {g.blocker && (
              <Notice tone="yellow" title="Can't check out yet">
                {g.blocker}
              </Notice>
            )}
          </Card>
        ))}
      </div>
    </Page>
  );
}
