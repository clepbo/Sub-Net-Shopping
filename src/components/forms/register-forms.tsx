"use client";

import { useActionState, useEffect, useState } from "react";
import { ImageUp, MapPin } from "lucide-react";
import { FormSteps } from "../form-steps";
import { LocationPicker } from "../map/location-picker";
import { registerCustomer, registerRider, registerSupermarket } from "@/app/actions/auth";
import type { ActionState } from "@/lib/action-state";
import { Field, FormMessage, Select, SubmitButton, TextArea } from "../form";

function PasswordFields({ state }: { state: ActionState }) {
  return (
    <>
      <Field label="Password" name="password" type="password" autoComplete="new-password" hint="At least 8 characters" required minLength={8} state={state} />
      <Field label="Confirm password" name="confirmPassword" type="password" autoComplete="new-password" required state={state} />
    </>
  );
}

function PhoneField({ state, label = "Phone number" }: { state: ActionState; label?: string }) {
  return <Field label={label} name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0803 123 4567" required state={state} />;
}

export function CustomerRegisterForm() {
  const [state, action] = useActionState(registerCustomer, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" name="firstName" autoComplete="given-name" state={state} />
        <Field label="Last name" name="lastName" autoComplete="family-name" state={state} />
      </div>
      <PhoneField state={state} />
      <Field label="Email" name="email" type="email" autoComplete="email" state={state} />
      <PasswordFields state={state} />
      <TermsNote />
      <SubmitButton className="w-full" pendingText="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}

export function SupermarketRegisterForm() {
  const [state, action] = useActionState(registerSupermarket, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <FormSteps
        state={state}
        submitLabel="Submit for approval"
        pendingText="Submitting…"
        steps={[
          {
            title: "Your store",
            fields: ["businessName", "address", "area", "latitude", "longitude"],
            content: (
              <>
                <Field label="Supermarket name" name="businessName" autoComplete="organization" required minLength={2} state={state} />
                <Field label="Business address" name="address" autoComplete="street-address" placeholder="12 Sapele Road" required minLength={5} state={state} />
                <Field label="Area" name="area" placeholder="e.g. GRA, Ugbowo, Ring Road" hint="Optional" state={state} />
                <OptionalMapPin state={state} />
              </>
            ),
          },
          {
            title: "Branding",
            fields: ["logo", "registrationNumber", "description"],
            content: (
              <>
                <LogoInput error={state.fieldErrors?.logo} />
                <Field label="CAC registration number" name="registrationNumber" hint="Optional, speeds up verification" state={state} />
                <TextArea label="About the supermarket" name="description" hint="Optional" state={state} />
              </>
            ),
          },
          {
            title: "Your login",
            fields: ["contactFirstName", "contactLastName", "phone", "email", "password", "confirmPassword"],
            content: (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="First name" name="contactFirstName" autoComplete="given-name" required state={state} />
                  <Field label="Last name" name="contactLastName" autoComplete="family-name" required state={state} />
                </div>
                <PhoneField state={state} label="Business phone" />
                <Field label="Business email" name="email" type="email" autoComplete="email" required state={state} />
                <PasswordFields state={state} />
                <TermsNote />
              </>
            ),
          },
        ]}
      />
    </form>
  );
}

function TermsNote() {
  return (
    <p className="text-xs text-gray-500">
      By continuing you agree to our{" "}
      <a href="/terms" target="_blank" className="underline">
        Terms
      </a>{" "}
      and{" "}
      <a href="/privacy" target="_blank" className="underline">
        Privacy Policy
      </a>
      .
    </p>
  );
}

/** Pinning the store on a map is optional at sign-up; a text link opens the picker. */
function OptionalMapPin({ state }: { state: ActionState }) {
  const pinned = Boolean(state.values?.latitude && state.values?.longitude);
  const [open, setOpen] = useState(pinned || Boolean(state.fieldErrors?.latitude));
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-sm font-bold text-brand-700 underline">
        <MapPin className="h-4 w-4" aria-hidden /> Pin your store on the map (optional)
      </button>
    );
  }
  return <LocationFields state={state} label="Your store on the map (optional)" />;
}

/** Optional logo with a preview. */
export function LogoInput({ error }: { error?: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);
  return (
    <div>
      <span className="mb-1 block text-sm font-semibold text-gray-800">Logo (optional)</span>
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-gray-300 p-3 hover:border-brand-600">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100 text-gray-400">
          {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the chosen file */}
          {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <ImageUp className="h-6 w-6" aria-hidden />}
        </span>
        <span className="text-sm">
          <span className="font-bold text-brand-700">{preview ? "Change logo" : "Upload your logo"}</span>
          <span className="block text-xs text-gray-500">JPG, PNG or WebP, up to 2 MB. You can add it later.</span>
        </span>
        <input
          type="file"
          name="logo"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            const f = e.target.files?.[0];
            setPreview(f ? URL.createObjectURL(f) : null);
          }}
        />
      </label>
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

/** The store's map location: tap the map or use the phone's GPS while at the store. */
export function LocationFields({
  state,
  defaults,
  label = "Store location on the map",
}: {
  state: ActionState;
  defaults?: { latitude: number | null; longitude: number | null };
  label?: string;
}) {
  const fromState =
    state.values?.latitude && state.values?.longitude ? { lat: Number(state.values.latitude), lng: Number(state.values.longitude) } : null;
  const fromDefaults = defaults?.latitude != null && defaults?.longitude != null ? { lat: defaults.latitude, lng: defaults.longitude } : null;
  return (
    <LocationPicker
      label={label}
      markerLabel="Your store"
      hint="Tap the map on your store's entrance, or press “Use my location” while you're at the store. Customers use this for directions and delivery prices."
      defaults={fromState ?? fromDefaults ?? undefined}
      error={state.fieldErrors?.latitude ?? state.fieldErrors?.longitude}
    />
  );
}

export const VEHICLE_OPTIONS = [
  { value: "MOTORCYCLE", label: "Motorcycle" },
  { value: "CAR", label: "Car" },
  { value: "VAN", label: "Van" },
  { value: "BULKY", label: "Truck / bulky-item vehicle" },
];

export function VehicleFields({ state, defaults }: { state: ActionState; defaults?: Record<string, string | null> }) {
  const d = (k: string) => defaults?.[k] ?? undefined;
  return (
    <>
      <Select label="Vehicle type" name="vehicleType" options={VEHICLE_OPTIONS} defaultValue={d("vehicleType")} state={state} />
      <Field label="Plate number" name="plateNumber" required minLength={3} placeholder="e.g. BEN 123 AB" autoCapitalize="characters" defaultValue={d("plateNumber")} state={state} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Make / model" name="vehicleMake" placeholder="e.g. Bajaj Boxer" defaultValue={d("vehicleMake")} state={state} />
        <Field label="Colour" name="vehicleColor" defaultValue={d("vehicleColor")} state={state} />
      </div>
      <Field label="Driver's licence number" name="driversLicense" hint="Optional, speeds up verification" defaultValue={d("driversLicense")} state={state} />
    </>
  );
}

export function RiderRegisterForm() {
  const [state, action] = useActionState(registerRider, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <FormSteps
        state={state}
        submitLabel="Submit for approval"
        pendingText="Submitting…"
        steps={[
          {
            title: "About you",
            fields: ["firstName", "lastName", "phone", "email"],
            content: (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="First name" name="firstName" autoComplete="given-name" required state={state} />
                  <Field label="Last name" name="lastName" autoComplete="family-name" required state={state} />
                </div>
                <PhoneField state={state} />
                <Field label="Email" name="email" type="email" autoComplete="email" required state={state} />
              </>
            ),
          },
          {
            title: "Your vehicle",
            fields: ["vehicleType", "plateNumber", "vehicleMake", "vehicleColor", "driversLicense"],
            content: <VehicleFields state={state} />,
          },
          {
            title: "Your login",
            fields: ["password", "confirmPassword"],
            content: (
              <>
                <PasswordFields state={state} />
                <TermsNote />
              </>
            ),
          },
        ]}
      />
    </form>
  );
}
