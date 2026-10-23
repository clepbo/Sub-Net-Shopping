import type { Metadata } from "next";
import { RiderRegisterForm } from "@/components/forms/register-forms";
import { Card, Notice, Page, PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Become a rider" };

export default function RegisterRiderPage() {
  return (
    <Page>
      <PageTitle eyebrow="For riders & drivers" title="Deliver with Sub Net" subtitle="Earn delivering supermarket orders in Benin City." />
      <Notice tone="yellow" title="Riders are approved before delivering">
        We review every rider and vehicle. You can go online to receive deliveries once approved.
      </Notice>
      <Card>
        <RiderRegisterForm />
      </Card>
    </Page>
  );
}
