"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { removeFromCart, setCartQuantity } from "@/app/actions/cart";
import { cancelMyOrder, checkout, payNow } from "@/app/actions/orders";
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

const PAYMENT_OPTIONS = [
  { value: "ONLINE", label: "Pay now online", hint: "Card, bank transfer or USSD via Paystack. Your order goes to the store once paid." },
  { value: "PAY_AT_STORE", label: "Pay at the store", hint: "Pay by cash, card or transfer when you collect." },
];

export type DeliveryOption = {
  addressId: string;
  label: string;
  address: string;
  /** Null when this address can't be delivered to. */
  feeKobo: number | null;
  detail: string;
};

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG")}`;

export function CheckoutForm({
  supermarketId,
  checkoutKey,
  subtotalKobo,
  onlineAvailable,
  pickupBlocker,
  deliveryBlocker,
  deliveryOptions,
  addAddressHref,
}: {
  supermarketId: string;
  checkoutKey: string;
  subtotalKobo: number;
  onlineAvailable: boolean;
  pickupBlocker: string | null;
  deliveryBlocker: string | null;
  deliveryOptions: DeliveryOption[];
  addAddressHref: string;
}) {
  const [state, action] = useActionState(checkout, {});
  // Riders don't handle cash yet, so delivery needs online payment.
  const deliveryUnavailable = deliveryBlocker ?? (onlineAvailable ? null : "Delivery needs online payment, which isn't available right now.");
  const [fulfilment, setFulfilment] = useState<"PICKUP" | "DELIVERY">(pickupBlocker && !deliveryUnavailable ? "DELIVERY" : "PICKUP");
  const firstDeliverable = deliveryOptions.find((o) => o.feeKobo !== null);
  const [addressId, setAddressId] = useState(firstDeliverable?.addressId ?? "");
  const paymentOptions = fulfilment === "DELIVERY" ? PAYMENT_OPTIONS.slice(0, 1) : onlineAvailable ? PAYMENT_OPTIONS : PAYMENT_OPTIONS.slice(1);
  const [chosenMethod, setMethod] = useState(paymentOptions[0].value);
  const method = paymentOptions.some((o) => o.value === chosenMethod) ? chosenMethod : paymentOptions[0].value;
  const fee = fulfilment === "DELIVERY" ? (deliveryOptions.find((o) => o.addressId === addressId)?.feeKobo ?? null) : 0;
  const blocked = fulfilment === "PICKUP" ? Boolean(pickupBlocker) : Boolean(deliveryUnavailable) || fee === null;
  const total = subtotalKobo + (fee ?? 0);

  const option = (active: boolean) => cx("flex cursor-pointer gap-3 rounded-xl border p-3", active ? "border-brand-600 bg-brand-50" : "border-gray-200");
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="supermarketId" value={supermarketId} />
      {/* One key per visit to the page, so a double tap creates one order. */}
      <input type="hidden" name="checkoutKey" value={checkoutKey} />

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold text-gray-800">How you&apos;ll get it</legend>
        {(
          [
            ["PICKUP", "Reserve & Pick Up", pickupBlocker ?? "Collect from the store. No fee."],
            ["DELIVERY", "Delivery", deliveryUnavailable ?? "A Sub Net rider brings it to you."],
          ] as const
        ).map(([value, label, hint]) => {
          const disabled = value === "PICKUP" ? Boolean(pickupBlocker) : Boolean(deliveryUnavailable);
          return (
            <label key={value} className={cx(option(fulfilment === value), disabled && "cursor-not-allowed opacity-60")}>
              <input
                type="radio"
                name="fulfilment"
                value={value}
                checked={fulfilment === value}
                disabled={disabled}
                onChange={() => setFulfilment(value)}
                className="mt-1 h-4 w-4 accent-brand-700"
              />
              <span>
                <span className="block text-sm font-bold text-gray-900">{label}</span>
                <span className="text-xs text-gray-600">{hint}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {fulfilment === "DELIVERY" && (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-semibold text-gray-800">Deliver to</legend>
          {deliveryOptions.map((o) => (
            <label key={o.addressId} className={cx(option(addressId === o.addressId), o.feeKobo === null && "cursor-not-allowed opacity-60")}>
              <input
                type="radio"
                name="addressId"
                value={o.addressId}
                checked={addressId === o.addressId}
                disabled={o.feeKobo === null}
                onChange={() => setAddressId(o.addressId)}
                className="mt-1 h-4 w-4 accent-brand-700"
              />
              <span className="min-w-0 flex-1">
                <span className="flex justify-between gap-2 text-sm font-bold text-gray-900">
                  {o.label}
                  {o.feeKobo !== null && <span>{naira(o.feeKobo)}</span>}
                </span>
                <span className="block truncate text-xs text-gray-600">{o.address}</span>
                <span className="text-xs text-gray-500">{o.detail}</span>
              </span>
            </label>
          ))}
          <Link href={addAddressHref} className="inline-block text-sm font-bold text-brand-700">
            + Add a delivery address
          </Link>
        </fieldset>
      )}

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold text-gray-800">Payment</legend>
        {paymentOptions.map((o) => (
          <label key={o.value} className={option(method === o.value)}>
            <input type="radio" name="paymentMethod" value={o.value} checked={method === o.value} onChange={() => setMethod(o.value)} className="mt-1 h-4 w-4 accent-brand-700" />
            <span>
              <span className="block text-sm font-bold text-gray-900">{o.label}</span>
              <span className="text-xs text-gray-600">{o.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <dl className="space-y-1 border-t border-gray-200 pt-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-600">Subtotal</dt>
          <dd>{naira(subtotalKobo)}</dd>
        </div>
        {fulfilment === "DELIVERY" && (
          <div className="flex justify-between">
            <dt className="text-gray-600">Delivery</dt>
            <dd>{fee === null ? "—" : naira(fee)}</dd>
          </div>
        )}
        <div className="flex justify-between text-base font-extrabold">
          <dt>Total</dt>
          <dd>{naira(total)}</dd>
        </div>
      </dl>

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
      <SubmitButton className="w-full" disabled={blocked} pendingText={method === "ONLINE" ? "Opening Paystack…" : "Placing order…"}>
        {method === "ONLINE" ? `Pay ${naira(total)}` : "Place order"}
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

export function PayNowButton({ orderId, totalLabel }: { orderId: string; totalLabel: string }) {
  const [state, action] = useActionState(payNow, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="orderId" value={orderId} />
      <SubmitButton pendingText="Opening Paystack…">Pay {totalLabel} now</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
