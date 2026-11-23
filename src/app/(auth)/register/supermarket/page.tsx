import type { Metadata } from "next";
import Link from "next/link";
import { SupermarketRegisterForm } from "@/components/forms/register-forms";
import { AuthLayout } from "@/components/auth-layout";

export const metadata: Metadata = { title: "Register a supermarket" };

export default function RegisterSupermarketPage() {
  return (
    <AuthLayout
      audience="supermarket"
      wide
      eyebrow="For supermarkets"
      title="Sell on SubNet"
      subtitle="Reach shoppers across Benin City with your existing store."
      footer={
        <p>
          Already registered?{" "}
          <Link href="/login" className="font-bold text-brand-700 underline">
            Sign in
          </Link>
        </p>
      }
    >
      <SupermarketRegisterForm />
    </AuthLayout>
  );
}
