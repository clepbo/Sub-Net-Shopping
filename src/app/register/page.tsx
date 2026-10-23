import type { Metadata } from "next";
import Link from "next/link";
import { CustomerRegisterForm } from "@/components/forms/register-forms";
import { Card, Page, PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <Page>
      <PageTitle title="Create your account" subtitle="Shop verified supermarkets across Benin City." />
      <Card>
        <CustomerRegisterForm />
      </Card>
      <p className="text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-brand-700 underline">
          Sign in
        </Link>
      </p>
      <p className="text-center text-sm text-gray-500">
        <Link href="/register/supermarket" className="underline">
          Register a supermarket
        </Link>{" "}
        ·{" "}
        <Link href="/register/rider" className="underline">
          Become a rider
        </Link>
      </p>
    </Page>
  );
}
