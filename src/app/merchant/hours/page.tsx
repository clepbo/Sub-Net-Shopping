import type { Metadata } from "next";
import { requireMerchantStore } from "@/lib/supermarkets";
import { ScheduleForm } from "@/components/forms/merchant-forms";
import { Card, Page, PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Opening hours" };

export default async function MerchantHoursPage() {
  const { store } = await requireMerchantStore();
  return (
    <Page>
      <PageTitle
        eyebrow="Merchant"
        title="Opening hours"
        subtitle="Store, pickup and delivery can run on separate schedules. All times are Benin City time."
      />
      <Card>
        <ScheduleForm schedule={store} disabled={store.status === "SUSPENDED"} />
      </Card>
    </Page>
  );
}
