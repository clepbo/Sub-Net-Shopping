"use client";

import { useActionState } from "react";
import {
  createRiderPayoutAction,
  createSettlementAction,
  markRiderPayoutPaidAction,
  markSettlementPaidAction,
  retryRefundAction,
} from "@/app/actions/finance";
import { FormMessage, SubmitButton } from "../form";

export function CreateSettlementButton({ supermarketId }: { supermarketId: string }) {
  const [state, action] = useActionState(createSettlementAction, {});
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="supermarketId" value={supermarketId} />
      <SubmitButton size="sm" pendingText="Creating…">
        Create statement
      </SubmitButton>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

export function MarkPaidForm({ settlementId }: { settlementId: string }) {
  const [state, action] = useActionState(markSettlementPaidAction, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="settlementId" value={settlementId} />
      <input name="reference" placeholder="Transfer reference" aria-label="Transfer reference" className="h-9 w-40 rounded-lg border border-gray-300 px-2 text-sm" />
      <SubmitButton size="sm" variant="secondary" pendingText="…">
        Mark paid
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function RetryRefundButton({ refundId }: { refundId: string }) {
  const [state, action] = useActionState(retryRefundAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="refundId" value={refundId} />
      <SubmitButton size="sm" variant="secondary" pendingText="…">
        Retry
      </SubmitButton>
      {state.ok && <span className="ml-2 text-xs text-brand-700">{state.ok}</span>}
    </form>
  );
}

export function CreateRiderPayoutButton({ riderId }: { riderId: string }) {
  const [state, action] = useActionState(createRiderPayoutAction, {});
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="riderId" value={riderId} />
      <SubmitButton size="sm" pendingText="Creating…">
        Create payout
      </SubmitButton>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

export function MarkRiderPayoutPaidForm({ payoutId }: { payoutId: string }) {
  const [state, action] = useActionState(markRiderPayoutPaidAction, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="payoutId" value={payoutId} />
      <input name="reference" placeholder="Transfer reference" aria-label="Transfer reference" className="h-9 w-40 rounded-lg border border-gray-300 px-2 text-sm" />
      <SubmitButton size="sm" variant="secondary" pendingText="…">
        Mark paid
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
