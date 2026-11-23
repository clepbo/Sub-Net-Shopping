import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatNaira, splitCommission } from "@/lib/money";
import { breakEvenMarkupPercent, customerPrice } from "@/lib/pricing-math";
import { SettingsForm } from "@/components/forms/admin-forms";
import { Card, Page, PageTitle, SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettings() {
  await requireUser("ADMIN");
  const settings = await getSettings();
  const markup = Number(settings.defaultMarkupPercent);
  const shelf = 1_000_000;
  const price = customerPrice(shelf, markup);
  const gateway = Math.round((price * Number(settings.gatewayFeePercent)) / 100);
  const breakEven = breakEvenMarkupPercent(Number(settings.supermarketCommissionPercent), Number(settings.gatewayFeePercent));
  const rider = splitCommission(500_000, Number(settings.riderCommissionPercent));

  return (
    <Page>
      <PageTitle eyebrow="Admin" title="Platform settings" />
      <Card>
        <SectionTitle>Pricing, commission &amp; delivery</SectionTitle>
        <SettingsForm values={settings} />
      </Card>
      <Card>
        <SectionTitle>With the current rates</SectionTitle>
        <ul className="space-y-1 text-sm text-gray-700">
          <li>
            Shelf price {formatNaira(shelf)} → customers pay {formatNaira(price)} · gateway ≈ {formatNaira(gateway)} · SubNet keeps ≈{" "}
            {formatNaira(price - shelf - gateway)} · supermarket gets {formatNaira(shelf)}
          </li>
          <li className={markup < breakEven ? "font-bold text-red-700" : "text-gray-500"}>
            Break-even markup for a {settings.supermarketCommissionPercent}% cut after a {settings.gatewayFeePercent}% gateway fee: {breakEven.toFixed(2)}%
            {markup < breakEven && " (your default markup is below this)"}
          </li>
          <li>
            {formatNaira(500_000)} delivery fee → SubNet {formatNaira(rider.commissionKobo)}, rider {formatNaira(rider.netKobo)}
          </li>
        </ul>
        <p className="mt-2 text-xs text-gray-500">Rates are recorded on each order when it&apos;s placed.</p>
      </Card>
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-bold text-brand-700 lg:hidden">
        <Link href="/admin/categories">Categories →</Link>
        <Link href="/admin/orders">Orders →</Link>
        <Link href="/admin/payments">Payments →</Link>
        <Link href="/admin/settlements">Settlements →</Link>
        <Link href="/admin/activity">Activity →</Link>
      </div>
    </Page>
  );
}
