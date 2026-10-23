import type { Metadata } from "next";
import { SupermarketRegisterForm } from "@/components/forms/register-forms";
import { Card, Notice, Page, PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Register a supermarket" };

export default function RegisterSupermarketPage() {
  return (
    <Page>
      <PageTitle eyebrow="For supermarkets" title="Sell on Sub Net" subtitle="Reach shoppers across Benin City with your existing store." />
      <Notice tone="yellow" title="Every supermarket is verified">
        After you register, our team reviews your details. Your store becomes visible to customers once approved.
      </Notice>
      <Card>
        <SupermarketRegisterForm />
      </Card>
    </Page>
  );
}
