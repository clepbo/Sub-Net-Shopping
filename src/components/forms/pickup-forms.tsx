"use client";

import { useActionState } from "react";
import { completeCollection, markReadyForPickup } from "@/app/actions/merchant-orders";
import { FormMessage, SubmitButton } from "../form";

export function CollectForm({ orderId, token, pin, label }: { orderId: string; token?: string; pin?: string; label: string }) {
  const [state, action] = useActionState(completeCollection, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="orderId" value={orderId} />
      {token && <input type="hidden" name="token" value={token} />}
      {pin && <input type="hidden" name="pin" value={pin} />}
      <SubmitButton className="w-full" pendingText="Confirming…">
        {label}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function MarkReadyForm({ orderId }: { orderId: string }) {
  const [state, action] = useActionState(markReadyForPickup, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="orderId" value={orderId} />
      <SubmitButton variant="secondary" className="w-full" pendingText="Updating…">
        Mark ready for pickup
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
