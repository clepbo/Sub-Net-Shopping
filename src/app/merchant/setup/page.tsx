import type { Metadata } from "next";
import { PartyPopper } from "lucide-react";
import { requireMerchantStore } from "@/lib/supermarkets";
import { ScheduleForm } from "@/components/forms/merchant-forms";
import { Card, Page, PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Set up your store" };

export default async function MerchantSetupPage() {
  const { store } = await requireMerchantStore();
  return (
    <Page>
      <div className="flex items-start gap-3 rounded-2xl bg-brand-900 p-4 text-white">
        <PartyPopper className="h-6 w-6 shrink-0 text-accent-400" aria-hidden />
        <div>
          <p className="font-extrabold">{store.name} is approved!</p>
          <p className="text-sm text-brand-100">One last step before you take orders: tell customers when you&apos;re open.</p>
        </div>
      </div>
      <PageTitle
        eyebrow="Setup"
        title="Your opening and closing hours"
        subtitle="Set when the store opens and closes each day, and when pickup and delivery run. You can change these at any time under Hours."
      />
      <Card>
        <ScheduleForm schedule={store} disabled={store.status === "SUSPENDED"} setup={!store.onboardedAt} />
      </Card>
    </Page>
  );
}
