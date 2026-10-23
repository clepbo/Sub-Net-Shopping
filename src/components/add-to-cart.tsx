"use client";

import { useActionState, useState } from "react";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import { addToCart } from "@/app/actions/cart";
import { SubmitButton } from "./form";
import { cx } from "./ui";

/** Quantity stepper and add button for one supermarket's listing. */
export function AddToCart({ inventoryId, returnTo, compact = false }: { inventoryId: string; returnTo: string; compact?: boolean }) {
  const [state, action] = useActionState(addToCart, {});
  const [qty, setQty] = useState(1);
  const step = "flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40";
  return (
    <form action={action} className={cx("space-y-1.5", compact && "w-full")}>
      <input type="hidden" name="inventoryId" value={inventoryId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="quantity" value={qty} />
      <div className={cx("flex items-center gap-2", compact && "justify-between")}>
        {!compact && (
          <div className="flex items-center gap-1" role="group" aria-label="Quantity">
            <button type="button" className={step} onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Decrease quantity">
              <Minus className="h-4 w-4" aria-hidden />
            </button>
            <span className="w-8 text-center font-bold tabular-nums" aria-live="polite">
              {qty}
            </span>
            <button type="button" className={step} onClick={() => setQty((q) => Math.min(99, q + 1))} aria-label="Increase quantity">
              <Plus className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}
        <SubmitButton size="sm" variant="primary" className={cx(compact && "w-full")} pendingText="Adding…">
          <ShoppingCart className="h-4 w-4" aria-hidden /> Add to cart
        </SubmitButton>
      </div>
      {state.error && <p className="text-xs font-medium text-red-600">{state.error}</p>}
      {state.ok && <p className="text-xs font-medium text-brand-700">{state.ok}</p>}
    </form>
  );
}
