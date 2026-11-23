"use client";

import { useActionState } from "react";
import { getVirtualAccountAction } from "@/app/actions/rider";
import { recordRiderRemittance } from "@/app/actions/finance";
import { Field, FormMessage, Select, SubmitButton } from "../form";

export function GetAccountNumberButton() {
  const [state, action] = useActionState(getVirtualAccountAction, {});
  return (
    <form action={action} className="space-y-2">
      <SubmitButton pendingText="Creating…">Get my account number</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

/** Admin: record cash a rider paid in by hand, or correct the wallet. */
export function RecordRemittanceForm({ riderId }: { riderId: string }) {
  const [state, action] = useActionState(recordRiderRemittance, {});
  return (
    <form action={action} className="space-y-3" noValidate>
      <input type="hidden" name="riderId" value={riderId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Amount (₦)" name="amount" inputMode="decimal" placeholder="e.g. 15000" state={state} />
        <Select
          label="Type"
          name="type"
          options={[
            { value: "REMITTANCE", label: "Cash paid in (credit)" },
            { value: "ADJUSTMENT_CREDIT", label: "Correction: credit" },
            { value: "ADJUSTMENT_DEBIT", label: "Correction: debit" },
          ]}
          state={state}
        />
      </div>
      <Field label="Note" name="note" placeholder="e.g. Paid at office, receipt #123" state={state} />
      <SubmitButton variant="secondary" pendingText="Saving…">
        Record
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
