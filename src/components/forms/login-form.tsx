"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { Field, FormMessage, SubmitButton } from "../form";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(login, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <FormMessage state={state} />
      <Field label="Email or phone number" name="identifier" autoComplete="username" required state={state} />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required state={state} />
      <p className="-mt-2 text-right text-sm">
        <Link href="/forgot-password" className="font-bold text-brand-700 underline">
          Forgot password?
        </Link>
      </p>
      <SubmitButton className="w-full" pendingText="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}
