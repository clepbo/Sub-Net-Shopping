"use client";

import { useActionState } from "react";
import { decideRider, decideSupermarket, setAccountStatus, updatePlatformSettings } from "@/app/actions/admin";
import type { ApprovalStatus } from "@/generated/prisma/enums";
import { Field, FormMessage, SubmitButton } from "../form";

const OPTIONS: Record<ApprovalStatus, { decision: string; label: string; variant: "primary" | "danger" | "secondary" }[]> = {
  PENDING: [
    { decision: "APPROVED", label: "Approve", variant: "primary" },
    { decision: "REJECTED", label: "Reject", variant: "danger" },
  ],
  APPROVED: [{ decision: "SUSPENDED", label: "Suspend", variant: "danger" }],
  REJECTED: [{ decision: "APPROVED", label: "Approve", variant: "primary" }],
  SUSPENDED: [{ decision: "APPROVED", label: "Reactivate", variant: "primary" }],
};

export function DecisionForm({ kind, id, status }: { kind: "supermarket" | "rider"; id: string; status: ApprovalStatus }) {
  const [state, action] = useActionState(kind === "supermarket" ? decideSupermarket : decideRider, {});
  const options = OPTIONS[status];
  const needsReason = options.some((o) => o.decision !== "APPROVED");
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {needsReason && (
        <label className="block text-sm font-semibold text-gray-800">
          Reason <span className="font-normal text-gray-500">(required to reject or suspend; sent to the {kind})</span>
          <textarea name="reason" rows={2} maxLength={300} className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" />
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <SubmitButton key={o.decision} name="decision" value={o.decision} variant={o.variant} pendingText="Saving…">
            {o.label}
          </SubmitButton>
        ))}
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function AccountStatusButton({ id, suspended }: { id: string; suspended: boolean }) {
  const [state, action] = useActionState(setAccountStatus, {});
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={suspended ? "ACTIVE" : "SUSPENDED"} />
      <SubmitButton size="sm" variant={suspended ? "primary" : "secondary"} pendingText="…">
        {suspended ? "Reactivate" : "Suspend"}
      </SubmitButton>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

export function SettingsForm({
  values,
}: {
  values: { supermarketCommissionPercent: string; riderCommissionPercent: string; deliveryBaseFee: string; deliveryPerKm: string; deliveryMaxKm: string };
}) {
  const [state, action] = useActionState(updatePlatformSettings, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field
        label="Supermarket commission (%)"
        name="supermarketCommissionPercent"
        type="number"
        step="0.1"
        min={0}
        max={50}
        inputMode="decimal"
        defaultValue={values.supermarketCommissionPercent}
        hint="Taken from eligible Sub Net sales. PRD proposal: 10%."
        state={state}
      />
      <Field
        label="Rider commission (%)"
        name="riderCommissionPercent"
        type="number"
        step="0.1"
        min={0}
        max={50}
        inputMode="decimal"
        defaultValue={values.riderCommissionPercent}
        hint="Taken from delivery fees. PRD proposal: 5–7%."
        state={state}
      />
      <h3 className="pt-2 text-xs font-bold tracking-wider text-gray-600 uppercase">Delivery pricing</h3>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Base fee (₦)" name="deliveryBaseFee" type="number" min={0} inputMode="decimal" defaultValue={values.deliveryBaseFee} state={state} />
        <Field label="Per km (₦)" name="deliveryPerKm" type="number" min={0} inputMode="decimal" defaultValue={values.deliveryPerKm} state={state} />
        <Field label="Max distance (km)" name="deliveryMaxKm" type="number" min={1} inputMode="decimal" defaultValue={values.deliveryMaxKm} state={state} />
      </div>
      <p className="text-xs text-gray-500">Fee = (base + per km × road distance) × vehicle size (motorcycle 1×, car 1.6×, van 2.5×, truck 4×), rounded up to ₦50.</p>
      <SubmitButton>Save settings</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
