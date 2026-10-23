import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/session-token";
import { LoginForm } from "@/components/forms/login-form";
import { Card, Page, PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser();
  if (user?.status === "ACTIVE") redirect(ROLE_HOME[user.role]);
  const { next } = await searchParams;
  return (
    <Page>
      <PageTitle title="Welcome back" subtitle="Sign in to your Sub Net account." />
      <Card>
        <LoginForm next={next} />
      </Card>
      <div className="space-y-2 text-center text-sm">
        <p>
          New to Sub Net?{" "}
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
      </div>
    </Page>
  );
}
