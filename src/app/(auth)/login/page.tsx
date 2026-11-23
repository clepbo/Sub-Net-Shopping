import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/session-token";
import { LoginForm } from "@/components/forms/login-form";
import { AuthLayout } from "@/components/auth-layout";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser();
  if (user?.status === "ACTIVE") redirect(ROLE_HOME[user.role]);
  const { next } = await searchParams;
  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Shoppers, supermarkets, staff, riders and admins all sign in here."
      footer={
        <>
          <p>
            New to SubNet?{" "}
            <Link href="/register" className="font-bold text-brand-700 underline">
              Create an account
            </Link>
          </p>
        </>
      }
    >
      <LoginForm next={next} />
    </AuthLayout>
  );
}
