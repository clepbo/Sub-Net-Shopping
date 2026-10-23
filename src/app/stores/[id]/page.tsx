import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, Mail, MapPin, Navigation, Phone } from "lucide-react";
import { getApprovedSupermarket, availabilityOf } from "@/lib/supermarkets";
import { directionsUrl } from "@/lib/geo";
import { formatNigerianPhone } from "@/lib/phone";
import { DAY_NAMES, formatClock, lagosClock } from "@/lib/time";
import { StoreLogo } from "@/components/store-logo";
import { ServiceBadge, StoreStateBadge } from "@/components/store-status";
import { Card, Notice, Page, SectionTitle, buttonClass, cx } from "@/components/ui";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const store = await getApprovedSupermarket((await params).id);
  return { title: store?.name ?? "Supermarket" };
}

function windowText(start: string | null, end: string | null) {
  return start && end ? `${formatClock(start)} – ${formatClock(end)}` : "During store hours";
}

export default async function StorePage({ params }: Props) {
  const store = await getApprovedSupermarket((await params).id);
  if (!store) notFound();
  const now = new Date();
  const a = availabilityOf(store, now);
  const today = lagosClock(now).dayOfWeek;

  return (
    <Page>
      <div className="flex items-start gap-4">
        <StoreLogo name={store.name} url={store.logoUrl} size="lg" />
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl leading-tight font-extrabold">{store.name}</h1>
          <p className="flex items-center gap-1 text-xs font-bold text-brand-700">
            <BadgeCheck className="h-4 w-4" aria-hidden /> Verified supermarket
          </p>
          <StoreStateBadge availability={a} />
        </div>
      </div>

      {store.temporarilyClosed && (
        <Notice tone="red" title="Temporarily closed">
          {store.closureNote ?? "This supermarket has temporarily closed. Check back later."}
        </Notice>
      )}

      {store.description && <p className="text-sm text-gray-700">{store.description}</p>}

      <Card>
        <SectionTitle>Right now</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <ServiceBadge name="Pickup" status={a.pickup} />
          <ServiceBadge name="Delivery" status={a.delivery} />
        </div>
        {a.delivery.state === "PAUSED" && a.pickup.state === "AVAILABLE" && (
          <p className="mt-2 text-xs text-gray-600">Delivery is paused, but you can still Reserve &amp; Pick Up.</p>
        )}
        {a.today ? (
          <p className="mt-3 text-sm text-gray-600">
            Today: {formatClock(a.today.opensAt)} – {formatClock(a.today.closesAt)}
            {store.lastOrderTime && ` · last order ${formatClock(store.lastOrderTime)}`}
          </p>
        ) : (
          <p className="mt-3 text-sm text-gray-600">Closed today</p>
        )}
      </Card>

      <Card>
        <SectionTitle>Location &amp; contact</SectionTitle>
        <ul className="space-y-2 text-sm">
          <li className="flex gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
            <span>
              {store.address}
              {store.area && <span className="text-gray-500"> · {store.area}</span>}
            </span>
          </li>
          <li className="flex gap-2">
            <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
            <a href={`tel:${store.phone}`} className="font-medium text-brand-800 underline">
              {formatNigerianPhone(store.phone)}
            </a>
          </li>
          <li className="flex gap-2">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
            <a href={`mailto:${store.email}`} className="font-medium break-all text-brand-800 underline">
              {store.email}
            </a>
          </li>
        </ul>
        {store.latitude !== null && store.longitude !== null && (
          <a
            href={directionsUrl(store.latitude, store.longitude)}
            target="_blank"
            rel="noopener noreferrer"
            className={cx(buttonClass("primary"), "mt-4 w-full")}
          >
            <Navigation className="h-4 w-4" aria-hidden /> Get directions
          </a>
        )}
      </Card>

      <Card>
        <SectionTitle>Opening hours</SectionTitle>
        <table className="w-full text-sm">
          <tbody>
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const h = store.hours.find((x) => x.dayOfWeek === d);
              return (
                <tr key={d} className={cx(d === today && "font-bold text-brand-800")}>
                  <th scope="row" className="py-1 text-left font-medium">
                    {DAY_NAMES[d]}
                  </th>
                  <td className="py-1 text-right">
                    {h?.isOpen && h.opensAt && h.closesAt ? `${formatClock(h.opensAt)} – ${formatClock(h.closesAt)}` : "Closed"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-sm text-gray-600">
          <p>
            <span className="font-semibold text-gray-800">Pickup:</span>{" "}
            {store.pickupEnabled ? windowText(store.pickupStart, store.pickupEnd) : "Not offered"}
          </p>
          <p>
            <span className="font-semibold text-gray-800">Delivery:</span>{" "}
            {store.deliveryEnabled ? windowText(store.deliveryStart, store.deliveryEnd) : "Not offered"}
            {store.deliveryEnabled && store.lastDeliveryOrderTime && ` · last delivery order ${formatClock(store.lastDeliveryOrderTime)}`}
          </p>
        </div>
      </Card>

      <Notice tone="blue" title="Online shopping is coming soon">
        Browsing products, cart and checkout for this supermarket are being added next.
      </Notice>
    </Page>
  );
}
