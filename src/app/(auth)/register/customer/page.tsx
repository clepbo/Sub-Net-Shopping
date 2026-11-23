import type { Metadata } from "next";
import Link from "next/link";
import { CustomerRegisterForm } from "@/components/forms/register-forms";
import { AuthLayout } from "@/components/auth-layout";

export const metadata: Metadata = { title: "Create a shopper account" };

export default function RegisterCustomerPage() {
  return (
    <AuthLayout
      eyebrow="For shoppers"
      title="Create your account"
      subtitle="Shop supermarkets across Benin City."
      footer={
        <p>
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-brand-700 underline">
            Sign in
          </Link>
        </p>
      }
    >
      <CustomerRegisterForm />
    </AuthLayout>
  );
}
