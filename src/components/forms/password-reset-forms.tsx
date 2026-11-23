"use client";

import { useActionState } from "react";
import { completePasswordReset, requestPasswordReset } from "@/app/actions/auth";
import { Field, FormMessage, SubmitButton } from "../form";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field label="Email or phone number" name="identifier" autoComplete="username" required state={state} />
      <SubmitButton className="w-full" pendingText="Sending…">
        Send reset link
      </SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(completePasswordReset, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <Field label="New password" name="password" type="password" autoComplete="new-password" hint="At least 8 characters" required state={state} />
      <Field label="Confirm new password" name="confirmPassword" type="password" autoComplete="new-password" required state={state} />
      <SubmitButton className="w-full" pendingText="Saving…">
        Save new password
      </SubmitButton>
    </form>
  );
}
