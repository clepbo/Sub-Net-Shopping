"use client";

import { useActionState } from "react";
import { saveRiderBank, saveStoreBank } from "@/app/actions/bank";
import { BANKS } from "@/lib/banks";
import { Field, FormMessage, Select, SubmitButton } from "../form";

type Bank = { bankCode: string | null; bankAccountNumber: string | null; bankAccountName: string | null };

export function BankDetailsForm({ who, bank, disabled = false }: { who: "store" | "rider"; bank: Bank; disabled?: boolean }) {
  const [state, action] = useActionState(who === "store" ? saveStoreBank : saveRiderBank, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <fieldset disabled={disabled} className="space-y-4">
        <Select
          label="Bank"
          name="bankCode"
          defaultValue={bank.bankCode ?? ""}
          options={[{ value: "", label: "Choose your bank" }, ...BANKS.map((b) => ({ value: b.code, label: b.name }))]}
          state={state}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Account number" name="bankAccountNumber" inputMode="numeric" maxLength={10} defaultValue={bank.bankAccountNumber ?? ""} state={state} />
          <Field
            label="Account name"
            name="bankAccountName"
            defaultValue={bank.bankAccountName ?? ""}
            hint="Filled in from your bank when we can check it."
            state={state}
          />
        </div>
        <SubmitButton variant="secondary" pendingText="Checking…">
          Save bank details
        </SubmitButton>
        <FormMessage state={state} />
      </fieldset>
    </form>
  );
}
