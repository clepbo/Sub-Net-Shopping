import type { Metadata } from "next";
import Link from "next/link";
import { RiderRegisterForm } from "@/components/forms/register-forms";
import { AuthLayout } from "@/components/auth-layout";
import { Notice } from "@/components/ui";

export const metadata: Metadata = { title: "Become a rider" };

export default function RegisterRiderPage() {
  return (
    <AuthLayout
      audience="rider"
      wide
      eyebrow="For riders & drivers"
      title="Deliver with SubNet"
      subtitle="Earn delivering supermarket orders in Benin City."
      footer={
        <p>
          Already registered?{" "}
          <Link href="/login" className="font-bold text-brand-700 underline">
            Sign in
          </Link>
        </p>
      }
    >
      <Notice tone="yellow" title="Riders are approved before delivering">
        We review every rider and vehicle. You can go online to receive deliveries once approved.
      </Notice>
      <RiderRegisterForm />
    </AuthLayout>
  );
}
