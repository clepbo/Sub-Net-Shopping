import type { Metadata } from "next";
import { requireMerchantStore } from "@/lib/supermarkets";
import { StoreLogo } from "@/components/store-logo";
import { LogoForm, PosForm, StoreProfileForm } from "@/components/forms/merchant-forms";
import { Card, Page, PageTitle, SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Store profile" };

export default async function MerchantProfilePage() {
  const { store } = await requireMerchantStore();
  const disabled = store.status === "SUSPENDED";
  return (
    <Page>
      <PageTitle eyebrow="Merchant" title="Store profile" subtitle="This is what customers see about your supermarket." />
      <Card>
        <SectionTitle>Logo</SectionTitle>
        <div className="flex items-start gap-4">
          <StoreLogo name={store.name} url={store.logoUrl} size="lg" />
          <div className="min-w-0 flex-1">
            <LogoForm disabled={disabled} />
          </div>
        </div>
      </Card>
      <Card>
        <SectionTitle>Details</SectionTitle>
        <StoreProfileForm store={store} disabled={disabled} />
      </Card>
      <Card>
        <div id="pos" className="scroll-mt-32" />
        <SectionTitle>POS &amp; inventory system</SectionTitle>
        <p className="mb-4 text-sm text-gray-600">
          We aim to connect to your existing POS so you don&apos;t have to enter products and prices twice. Tell us what you use.
        </p>
        <PosForm pos={store} disabled={disabled} />
      </Card>
    </Page>
  );
}
