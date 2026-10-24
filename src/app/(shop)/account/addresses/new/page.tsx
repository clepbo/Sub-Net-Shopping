import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { formatNigerianPhone } from "@/lib/phone";
import { AddressForm } from "@/components/forms/address-form";
import { Card, Page, PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "New address" };

export default async function NewAddressPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await requireUser("CUSTOMER");
  const { next } = await searchParams;
  return (
    <Page className="mx-auto max-w-2xl">
      <PageTitle title="Add a delivery address" subtitle="The pin decides the delivery fee and guides the rider." />
      <Card>
        <AddressForm next={next} phone={formatNigerianPhone(user.phone)} />
      </Card>
    </Page>
  );
}
