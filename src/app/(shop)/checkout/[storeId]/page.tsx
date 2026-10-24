import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { ArrowLeft, Banknote, MapPin, ShoppingBag } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getCart } from "@/lib/cart";
import { formatNaira } from "@/lib/money";
import { db } from "@/lib/db";
import { deliveryQuote, VEHICLE_NAME } from "@/lib/delivery-rules";
import { paystackConfigured } from "@/lib/payments/paystack";
import { deliveryRates } from "@/lib/settings";
import { CheckoutForm } from "@/components/forms/cart-forms";
import { Card, Notice, Page, PageTitle, SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage({ params }: { params: Promise<{ storeId: string }> }) {
  const user = await requireUser("CUSTOMER");
  const { storeId } = await params;
  const group = (await getCart(user.id)).find((g) => g.supermarket.id === storeId);
  if (!group) redirect("/cart");
  const s = group.supermarket;
  const [addresses, rates] = await Promise.all([db.customerAddress.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }), deliveryRates()]);
  const items = group.lines.map((l) => ({ isBulky: l.isBulky, quantity: l.quantity }));
  const deliveryOptions = addresses.map((a) => {
    const q = deliveryQuote({
      from: s.latitude !== null && s.longitude !== null ? { lat: s.latitude, lng: s.longitude } : null,
      to: { lat: a.latitude, lng: a.longitude },
      items,
      rates,
    });
    return {
      addressId: a.id,
      label: a.label,
      address: a.address,
      feeKobo: q.ok ? q.feeKobo : null,
      detail: q.ok ? `About ${q.distanceKm} km · ${VEHICLE_NAME[q.vehicle].toLowerCase()} delivery` : q.reason,
    };
  });

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
            <SectionTitle>Supermarket</SectionTitle>
            <div className="flex gap-3">
              <ShoppingBag className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" aria-hidden />
              <div className="text-sm">
                <p className="font-bold">{s.name}</p>
                <p className="flex items-start gap-1 text-gray-600">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  {s.address}
                  {s.area && `, ${s.area}`}
                </p>
                <p className="mt-1 text-gray-600">We&apos;ll notify you at each step, whether you collect or we deliver.</p>
              </div>
            </div>
          </Card>
          <Card>
            <SectionTitle>Pickup code</SectionTitle>
            <div className="flex gap-3 text-sm">
              <Banknote className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" aria-hidden />
              <p className="text-gray-600">
                You&apos;ll get a QR code and PIN on your order page. Staff check it before handing over, so nobody else can collect your order.
              </p>
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
          <CheckoutForm
            supermarketId={s.id}
            checkoutKey={randomUUID()}
            subtotalKobo={group.subtotalKobo}
            onlineAvailable={paystackConfigured()}
            pickupBlocker={group.pickupBlocker ?? (group.lines.some((l) => l.issue) ? "Fix the items in your cart first." : null)}
            deliveryBlocker={group.deliveryBlocker ?? (group.lines.some((l) => l.issue) ? "Fix the items in your cart first." : null)}
            deliveryOptions={deliveryOptions}
            addAddressHref={`/account/addresses/new?next=${encodeURIComponent(`/checkout/${s.id}`)}`}
          />
          <p className="text-xs text-gray-500">Prices and stock are confirmed when you place the order.</p>
        </Card>
      </div>
    </Page>
  );
}
