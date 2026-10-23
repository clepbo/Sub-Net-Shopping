"use client";

import { useActionState } from "react";
import { setServicePause, setTemporaryClosure } from "@/app/actions/merchant";
import { FormMessage, SubmitButton } from "../form";

export function ClosureControl({ closed, note }: { closed: boolean; note: string | null }) {
  const [state, action] = useActionState(setTemporaryClosure, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="closed" value={closed ? "false" : "true"} />
      <div>
        <p className="font-semibold text-gray-900">Temporary closure</p>
        <p className="text-xs text-gray-500">
          {closed ? `Closed to customers${note ? `: “${note}”` : ""}.` : "Close the store for customers without changing your hours."}
        </p>
      </div>
      {!closed && (
        <input
          name="note"
          maxLength={200}
          placeholder="Reason shown to customers (optional)"
          aria-label="Closure reason"
          className="block w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
        />
      )}
      <SubmitButton variant={closed ? "primary" : "danger"} size="sm" pendingText="Updating…">
        {closed ? "Reopen store" : "Close temporarily"}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function PauseControl({
  service,
  pausedUntilLabel,
  offered,
}: {
  service: "delivery" | "pickup";
  /** Lagos time the pause ends, when currently paused. */
  pausedUntilLabel: string | null;
  offered: boolean;
}) {
  const [state, action] = useActionState(setServicePause, {});
  const name = service === "delivery" ? "Delivery" : "Pickup";
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="service" value={service} />
      <div>
        <p className="font-semibold text-gray-900">{name}</p>
        <p className="text-xs text-gray-500">
          {!offered
            ? `You don't currently offer ${service}. Turn it on under Hours.`
            : pausedUntilLabel
              ? `Paused until ${pausedUntilLabel}. Customers see “${name} temporarily unavailable”.`
              : `Running normally. Pause it for bad weather, busy periods or rider shortages.`}
        </p>
      </div>
      {offered && (
        <div className="flex flex-wrap items-center gap-2">
          {pausedUntilLabel && (
            <SubmitButton name="mode" value="resume" size="sm" pendingText="…">
              Resume now
            </SubmitButton>
          )}
          <SubmitButton name="mode" value="30m" variant="secondary" size="sm" pendingText="…">
            Pause 30 min
          </SubmitButton>
          <SubmitButton name="mode" value="1h" variant="secondary" size="sm" pendingText="…">
            Pause 1 hour
          </SubmitButton>
          <div className="flex items-center gap-1">
            <input
              type="time"
              name="until"
              aria-label={`Pause ${service} until`}
              className="rounded-xl border border-gray-300 px-2 py-1.5 text-sm"
            />
            <SubmitButton name="mode" value="until" variant="secondary" size="sm" pendingText="…">
              Pause until
            </SubmitButton>
          </div>
        </div>
      )}
      <FormMessage state={state} />
    </form>
  );
}
