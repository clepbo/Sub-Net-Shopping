import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { availabilityOf, getSupermarketForAdmin } from "@/lib/supermarkets";
import { directionsUrl } from "@/lib/geo";
import { formatNigerianPhone } from "@/lib/phone";
import { DAY_NAMES, formatClock, formatDateTime } from "@/lib/time";
import { ApprovalBadge } from "@/components/approval";
import { DecisionForm } from "@/components/forms/admin-forms";
import { StoreLogo } from "@/components/store-logo";
import { ServiceBadges, StoreStateBadge } from "@/components/store-status";
import { Card, DefinitionList, Notice, Page, SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Supermarket" };

export default async function AdminSupermarketDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("ADMIN");
  const store = await getSupermarketForAdmin((await params).id);
  if (!store) notFound();
  const a = availabilityOf(store);

  return (
    <Page>
      <div className="flex items-start gap-4">
        <StoreLogo name={store.name} url={store.logoUrl} size="lg" />
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl leading-tight font-extrabold">{store.name}</h1>
          <ApprovalBadge status={store.status} />
        </div>
      </div>

      {store.statusReason && (
        <Notice tone="red" title="Reason on record">
          {store.statusReason}
        </Notice>
      )}

      <Card>
        <SectionTitle>Decision</SectionTitle>
        <DecisionForm kind="supermarket" id={store.id} status={store.status} />
      </Card>

      <Card>
        <SectionTitle>Business details</SectionTitle>
        <DefinitionList
          items={[
            ["Contact person", store.contactName],
            ["Phone", <a key="p" href={`tel:${store.phone}`} className="underline">{formatNigerianPhone(store.phone)}</a>],
            ["Email", store.email],
            ["Address", store.address],
            ["Area", store.area],
            [
              "Location",
              store.latitude !== null && store.longitude !== null ? (
                <a key="l" href={directionsUrl(store.latitude, store.longitude)} target="_blank" rel="noopener noreferrer" className="underline">
                  {store.latitude.toFixed(5)}, {store.longitude.toFixed(5)}
                </a>
              ) : null,
            ],
            ["CAC number", store.registrationNumber],
            ["POS system", store.posProvider ? `${store.posProvider}${store.posHasApi ? " (has API)" : store.posHasApi === false ? " (no API)" : ""}` : null],
            ["Registered", formatDateTime(store.createdAt)],
            ["Approved", store.approvedAt ? formatDateTime(store.approvedAt) : null],
          ]}
        />
        {store.description && <p className="mt-3 text-sm text-gray-700">{store.description}</p>}
      </Card>

      <Card>
        <SectionTitle>Owner account</SectionTitle>
        <DefinitionList
          items={[
            ["Name", `${store.owner.firstName} ${store.owner.lastName}`],
            ["Email", store.owner.email],
            ["Account", store.owner.status === "ACTIVE" ? "Active" : "Suspended"],
          ]}
        />
      </Card>

      <Card>
        <SectionTitle>Operations</SectionTitle>
        <div className="mb-3 space-y-1.5">
          <StoreStateBadge availability={a} />
          <ServiceBadges availability={a} />
        </div>
        <table className="w-full text-sm">
          <tbody>
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const h = store.hours.find((x) => x.dayOfWeek === d);
              return (
                <tr key={d}>
                  <th scope="row" className="py-0.5 text-left font-medium text-gray-600">{DAY_NAMES[d]}</th>
                  <td className="py-0.5 text-right">
                    {h?.isOpen && h.opensAt && h.closesAt ? `${formatClock(h.opensAt)} – ${formatClock(h.closesAt)}` : "Closed"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </Page>
  );
}
