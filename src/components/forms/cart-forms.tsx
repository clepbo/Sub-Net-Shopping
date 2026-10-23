"use client";

import { useActionState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { removeFromCart, setCartQuantity } from "@/app/actions/cart";
import { cancelMyOrder, checkout } from "@/app/actions/orders";
import { FormMessage, SubmitButton } from "../form";
import { buttonClass, cx } from "../ui";

export function CartQuantity({ cartItemId, quantity, name }: { cartItemId: string; quantity: number; name: string }) {
  const step = "flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white hover:bg-gray-50";
  return (
    <div className="flex items-center gap-1">
      <form action={setCartQuantity}>
        <input type="hidden" name="cartItemId" value={cartItemId} />
        <input type="hidden" name="quantity" value={quantity - 1} />
        <button className={step} aria-label={quantity === 1 ? `Remove ${name}` : `One fewer ${name}`}>
          {quantity === 1 ? <Trash2 className="h-4 w-4 text-red-600" aria-hidden /> : <Minus className="h-4 w-4" aria-hidden />}
        </button>
      </form>
      <span className="w-8 text-center font-bold tabular-nums">{quantity}</span>
      <form action={setCartQuantity}>
        <input type="hidden" name="cartItemId" value={cartItemId} />
        <input type="hidden" name="quantity" value={quantity + 1} />
        <button className={step} aria-label={`One more ${name}`} disabled={quantity >= 99}>
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}

export function RemoveFromCart({ cartItemId, name }: { cartItemId: string; name: string }) {
  return (
    <form action={removeFromCart}>
      <input type="hidden" name="cartItemId" value={cartItemId} />
      <button className="text-xs font-semibold text-red-700 hover:underline" aria-label={`Remove ${name} from cart`}>
        Remove
      </button>
    </form>
  );
}

export function CheckoutForm({ supermarketId, checkoutKey, disabled }: { supermarketId: string; checkoutKey: string; disabled: boolean }) {
  const [state, action] = useActionState(checkout, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="supermarketId" value={supermarketId} />
      {/* One key per visit to the page, so a double tap creates one order. */}
      <input type="hidden" name="checkoutKey" value={checkoutKey} />
      <label className="block text-sm font-semibold text-gray-800">
        Note for the supermarket <span className="font-normal text-gray-500">(optional)</span>
        <textarea
          name="note"
          rows={2}
          maxLength={300}
          placeholder="e.g. Substitute with a similar brand if out of stock"
          className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
        />
      </label>
      <FormMessage state={state} />
      <SubmitButton className="w-full" disabled={disabled} pendingText="Placing order…">
        Place order
      </SubmitButton>
    </form>
  );
}

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const [state, action] = useActionState(cancelMyOrder, {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Cancel this order?")) e.preventDefault();
      }}
      className="space-y-2"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <button className={cx(buttonClass("secondary", "sm"), "text-red-700")}>Cancel order</button>
      <FormMessage state={state} />
    </form>
  );
}
