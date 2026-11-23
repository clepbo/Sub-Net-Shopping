import type { Metadata } from "next";
import Link from "next/link";
import { AuthLayout } from "@/components/auth-layout";
import { ResetPasswordForm } from "@/components/forms/password-reset-forms";
import { findValidToken } from "@/lib/password-reset";
import { LinkButton, Notice } from "@/components/ui";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; invite?: string }> }) {
  const sp = await searchParams;
  const token = sp.token ?? "";
  const invite = sp.invite === "1";
  const valid = await findValidToken(token);
  return (
    <AuthLayout
      title={invite ? "Set your password" : "Choose a new password"}
      subtitle={valid ? (invite ? `Your login is ${valid.user.email}.` : `For ${valid.user.email}. You'll be signed out everywhere else.`) : undefined}
      footer={
        <p>
          <Link href="/login" className="font-bold text-brand-700 underline">
            Back to sign in
          </Link>
        </p>
      }
    >
      {valid ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="space-y-4">
          <Notice tone="red" title="This link has expired or was already used">
            {invite ? "Ask your store manager to resend your invite, or request a reset link below." : "Reset links work once, for an hour. Ask for a new one below."}
          </Notice>
          <LinkButton href="/forgot-password" className="w-full">
            Send a new link
          </LinkButton>
        </div>
      )}
    </AuthLayout>
  );
}
