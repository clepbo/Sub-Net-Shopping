import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatNigerianPhone } from "@/lib/phone";
import { deleteAddress } from "@/app/actions/addresses";
import { EmptyState, LinkButton, Page, PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Addresses" };

export default async function AddressesPage() {
  const user = await requireUser("CUSTOMER");
  const addresses = await db.customerAddress.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  return (
    <Page className="mx-auto max-w-2xl">
      <PageTitle title="Delivery addresses" action={<LinkButton href="/account/addresses/new" size="sm">Add address</LinkButton>} />
      {addresses.length === 0 ? (
        <EmptyState icon={<MapPin className="h-8 w-8" />} title="No saved addresses">
          Add one to get supermarket orders delivered.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {addresses.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4">
              <div className="min-w-0 text-sm">
                <p className="font-bold">{a.label}</p>
                <p className="text-gray-700">{a.address}</p>
                {a.landmark && <p className="text-gray-500">{a.landmark}</p>}
                <p className="text-gray-500">{formatNigerianPhone(a.phone)}</p>
              </div>
              <form action={deleteAddress}>
                <input type="hidden" name="addressId" value={a.id} />
                <button className="text-xs font-semibold text-red-700 hover:underline">Remove</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
