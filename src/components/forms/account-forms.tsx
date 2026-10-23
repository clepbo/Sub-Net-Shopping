"use client";

import { useActionState } from "react";
import { changePassword, updateProfile } from "@/app/actions/account";
import { formatNigerianPhone } from "@/lib/phone";
import { Field, FormMessage, SubmitButton } from "../form";

export function ProfileForm({ user }: { user: { firstName: string; lastName: string; phone: string } }) {
  const [state, action] = useActionState(updateProfile, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" name="firstName" defaultValue={user.firstName} autoComplete="given-name" state={state} />
        <Field label="Last name" name="lastName" defaultValue={user.lastName} autoComplete="family-name" state={state} />
      </div>
      <Field label="Phone number" name="phone" type="tel" defaultValue={formatNigerianPhone(user.phone)} autoComplete="tel" state={state} />
      <SubmitButton>Save profile</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field label="Current password" name="currentPassword" type="password" autoComplete="current-password" state={state} />
      <Field label="New password" name="password" type="password" autoComplete="new-password" hint="At least 8 characters" state={state} />
      <Field label="Confirm new password" name="confirmPassword" type="password" autoComplete="new-password" state={state} />
      <SubmitButton variant="secondary">Change password</SubmitButton>
    </form>
  );
}
