"use client";

import { useActionState } from "react";
import { saveAddress } from "@/app/actions/addresses";
import { Field, FormMessage, SubmitButton } from "../form";
import { LocationPicker } from "../map/location-picker";

export function AddressForm({ next, phone }: { next?: string; phone: string }) {
  const [state, action] = useActionState(saveAddress, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <FormMessage state={state} />
      <Field label="Name for this address" name="label" placeholder="Home, Office…" defaultValue="Home" state={state} />
      <Field label="Street address" name="address" placeholder="e.g. 12 Ugbowo-Lagos Road" autoComplete="street-address" state={state} />
      <Field label="Landmark" name="landmark" placeholder="e.g. Opposite UNIBEN main gate" hint="Helps the rider find you" state={state} />
      <Field label="Phone for the rider" name="phone" type="tel" defaultValue={phone} state={state} />
      <LocationPicker error={state.fieldErrors?.latitude} />
      <SubmitButton className="w-full">Save address</SubmitButton>
    </form>
  );
}
