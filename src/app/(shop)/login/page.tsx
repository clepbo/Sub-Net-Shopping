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
      subtitle="Sign in to your SubNet account: customers, supermarkets, riders and admins all sign in here."
      footer={
        <>
          <p>
            New to SubNet?{" "}
            <Link href="/register" className="font-bold text-brand-700 underline">
              Create an account
            </Link>
          </p>
          <p className="text-gray-500">
            <Link href="/register/supermarket" className="underline">
              Register a supermarket
            </Link>{" "}
            ·{" "}
            <Link href="/register/rider" className="underline">
              Become a rider
            </Link>
          </p>
        </>
      }
    >
      <LoginForm next={next} />
    </AuthLayout>
  );
}
