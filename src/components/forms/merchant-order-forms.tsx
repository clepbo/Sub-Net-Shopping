"use client";

import { useActionState, useState } from "react";
import { adjustItem, updateOrderStatus } from "@/app/actions/merchant-orders";
import type { OrderStatus } from "@/generated/prisma/enums";
import { FormMessage, SubmitButton } from "../form";
import { buttonClass, cx } from "../ui";

const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string; hint: string }>> = {
  PLACED: { to: "CONFIRMED", label: "Confirm order", hint: "Check stock first. You can reduce or remove items below before confirming." },
  CONFIRMED: { to: "READY_FOR_PICKUP", label: "Mark ready for pickup", hint: "Do this once the order is bagged. The customer is notified." },
  READY_FOR_PICKUP: { to: "COLLECTED", label: "Payment received & collected", hint: "Check the order number, take payment, then hand over." },
};

export function OrderActions({ orderId, status, totalLabel }: { orderId: string; status: OrderStatus; totalLabel: string }) {
  const [state, action] = useActionState(updateOrderStatus, {});
  const [cancelling, setCancelling] = useState(false);
  const next = NEXT[status];
  if (!next) return null;
  return (
    <div className="space-y-3">
      <form action={action} className="space-y-2">
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="to" value={next.to} />
        <p className="text-sm text-gray-600">{next.hint}</p>
        <SubmitButton className="w-full sm:w-auto" pendingText="Updating…">
          {next.label}
          {next.to === "COLLECTED" && ` (${totalLabel})`}
        </SubmitButton>
      </form>
      {cancelling ? (
        <form action={action} className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3">
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="to" value="CANCELLED" />
          <label className="block text-sm font-semibold text-red-900">
            Reason (sent to the customer)
            <textarea name="reason" required rows={2} maxLength={300} className="mt-1 block w-full rounded-xl border border-red-300 bg-white px-3 py-2 text-sm" />
          </label>
          <div className="flex gap-2">
            <SubmitButton variant="danger" size="sm" pendingText="Cancelling…">
              Cancel order
            </SubmitButton>
            <button type="button" onClick={() => setCancelling(false)} className={buttonClass("secondary", "sm")}>
              Keep order
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setCancelling(true)} className={cx(buttonClass("ghost", "sm"), "text-red-700")}>
          Cancel order…
        </button>
      )}
      <FormMessage state={state} />
    </div>
  );
}

export function AdjustItemForm({ orderItemId, quantity, requested, name }: { orderItemId: string; quantity: number; requested: number; name: string }) {
  const [state, action] = useActionState(adjustItem, {});
  return (
    <form action={action} className="flex items-center gap-1.5">
      <input type="hidden" name="orderItemId" value={orderItemId} />
      <select
        name="quantity"
        defaultValue={quantity}
        key={quantity}
        aria-label={`Quantity to supply of ${name}`}
        className="h-8 rounded-lg border border-gray-300 bg-white px-1.5 text-sm"
      >
        {Array.from({ length: requested + 1 }, (_, n) => (
          <option key={n} value={n}>
            {n === 0 ? "0 (unavailable)" : n}
          </option>
        ))}
      </select>
      <SubmitButton variant="secondary" size="sm" pendingText="…">
        Update
      </SubmitButton>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
