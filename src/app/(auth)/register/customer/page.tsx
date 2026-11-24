import type { Metadata } from "next";
import Link from "next/link";
import { CustomerRegisterForm } from "@/components/forms/register-forms";
import { AuthLayout } from "@/components/auth-layout";

export const metadata: Metadata = { title: "Create a shopper account" };

export default async function RegisterCustomerPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthLayout
      eyebrow="For shoppers"
      title="Create your account"
      subtitle="Shop supermarkets across Benin City."
      footer={
        <p>
          Already have an account?{" "}
          <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-bold text-brand-700 underline">
            Sign in
          </Link>
        </p>
      }
    >
      <CustomerRegisterForm next={next?.startsWith("/") && !next.startsWith("//") ? next : undefined} />
    </AuthLayout>
  );
}
