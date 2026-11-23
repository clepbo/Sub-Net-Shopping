import type { Metadata } from "next";
import { requireMerchantStore } from "@/lib/supermarkets";
import { StoreLogo } from "@/components/store-logo";
import { LogoForm, PosForm, StoreProfileForm } from "@/components/forms/merchant-forms";
import { Card, Page, PageTitle, SectionTitle } from "@/components/ui";
import { BankDetailsForm } from "@/components/forms/bank-forms";
import { PosFeedForm, PosKeyControls } from "@/components/forms/pos-connection-forms";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/app-url";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Store profile" };

export default async function MerchantProfilePage() {
  const { store } = await requireMerchantStore({ managerOnly: true });
  const disabled = store.status === "SUSPENDED";
  const syncs = await db.posSyncRun.findMany({ where: { supermarketId: store.id }, orderBy: { startedAt: "desc" }, take: 8 });
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
        <div id="bank" className="scroll-mt-32" />
        <SectionTitle>Payout bank account</SectionTitle>
        <p className="mb-4 text-sm text-gray-600">Each night at 10 PM, SubNet sends the day&apos;s earnings here in one transfer.</p>
        <BankDetailsForm who="store" bank={store} disabled={disabled} />
      </Card>
      <Card>
        <div id="pos" className="scroll-mt-32" />
        <SectionTitle>POS &amp; inventory system</SectionTitle>
        <p className="mb-4 text-sm text-gray-600">
          We aim to connect to your existing POS so you don&apos;t have to enter products and prices twice. Tell us what you use.
        </p>
        <PosForm pos={store} disabled={disabled} />
      </Card>
      <Card className="space-y-5">
        <SectionTitle>Live POS connection</SectionTitle>
        <p className="text-sm text-gray-600">Keep prices and stock in step with your POS automatically, in either of two ways:</p>
        <div className="space-y-2">
          <h3 className="text-sm font-extrabold">1. Your POS sends updates to SubNet</h3>
          <PosKeyControls hint={store.posApiKeyHint} endpoint={`${await appUrl()}/api/pos/v1/items`} disabled={disabled} />
        </div>
        <div className="space-y-2 border-t border-gray-100 pt-4">
          <h3 className="text-sm font-extrabold">2. SubNet reads a feed from your POS</h3>
          <PosFeedForm url={store.posFeedUrl} disabled={disabled} />
        </div>
        {syncs.length > 0 && (
          <div className="border-t border-gray-100 pt-4">
            <h3 className="mb-2 text-xs font-bold tracking-wider text-gray-600 uppercase">Recent syncs</h3>
            <ul className="space-y-1 text-xs">
              {syncs.map((r) => (
                <li key={r.id} className="flex flex-wrap justify-between gap-2">
                  <span>
                    {formatDateTime(r.startedAt)} · {r.provider === "api" ? "POS push" : r.provider === "feed" ? "Feed" : "CSV import"}
                  </span>
                  <span className={r.status === "FAILED" ? "font-bold text-red-700" : "text-gray-600"}>
                    {r.status === "FAILED" ? `Failed: ${r.error}` : `${r.itemsUpdated} of ${r.itemsSeen} updated${r.error ? ` · ${r.error}` : ""}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </Page>
  );
}
