import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { ArrowLeft, Banknote, MapPin, ShoppingBag } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getCart } from "@/lib/cart";
import { formatNaira } from "@/lib/money";
import { CheckoutForm } from "@/components/forms/cart-forms";
import { OrderTotals } from "@/components/order-ui";
import { Card, Notice, Page, PageTitle, SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage({ params }: { params: Promise<{ storeId: string }> }) {
  const user = await requireUser("CUSTOMER");
  const { storeId } = await params;
  const group = (await getCart(user.id)).find((g) => g.supermarket.id === storeId);
  if (!group) redirect("/cart");
  const s = group.supermarket;

  return (
    <Page className="mx-auto max-w-3xl">
      <Link href="/cart" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Cart
      </Link>
      <PageTitle title="Checkout" subtitle={s.name} />
      {group.blocker && (
        <Notice tone="yellow" title="This order can't be placed right now">
          {group.blocker}
        </Notice>
      )}
      <div className="grid gap-5 md:grid-cols-2 md:items-start">
        <div className="space-y-5">
          <Card>
            <SectionTitle>How you&apos;ll get it</SectionTitle>
            <div className="flex gap-3">
              <ShoppingBag className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" aria-hidden />
              <div className="text-sm">
                <p className="font-bold">Reserve &amp; Pick Up</p>
                <p className="flex items-start gap-1 text-gray-600">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  {s.address}
                  {s.area && `, ${s.area}`}
                </p>
                <p className="mt-1 text-gray-600">We&apos;ll notify you when it&apos;s bagged and ready. Delivery is coming soon.</p>
              </div>
            </div>
          </Card>
          <Card>
            <SectionTitle>Payment</SectionTitle>
            <div className="flex gap-3 text-sm">
              <Banknote className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" aria-hidden />
              <div>
                <p className="font-bold">Pay at the store</p>
                <p className="text-gray-600">Pay the supermarket when you collect, by cash, card or transfer. Online payment is coming soon.</p>
              </div>
            </div>
          </Card>
        </div>
        <Card className="space-y-4">
          <SectionTitle>Order summary</SectionTitle>
          <ul className="space-y-1.5 text-sm">
            {group.lines.map((l) => (
              <li key={l.id} className="flex justify-between gap-3">
                <span className="min-w-0">
                  {l.quantity} × {l.name}
                  {l.issue && <span className="block text-xs font-bold text-red-700">{l.issue}</span>}
                </span>
                <span className="shrink-0 tabular-nums">{formatNaira(l.lineTotalKobo)}</span>
              </li>
            ))}
          </ul>
          <OrderTotals subtotalKobo={group.subtotalKobo} deliveryFeeKobo={0} totalKobo={group.subtotalKobo} />
          <CheckoutForm supermarketId={s.id} checkoutKey={randomUUID()} disabled={Boolean(group.blocker)} />
          <p className="text-xs text-gray-500">Prices and stock are confirmed when you place the order.</p>
        </Card>
      </div>
    </Page>
  );
}
