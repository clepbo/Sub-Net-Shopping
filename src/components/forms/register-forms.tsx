"use client";

import { useActionState, useState } from "react";
import { LocateFixed } from "lucide-react";
import { registerCustomer, registerRider, registerSupermarket } from "@/app/actions/auth";
import type { ActionState } from "@/lib/action-state";
import { Field, FormMessage, Select, SubmitButton, TextArea } from "../form";
import { buttonClass } from "../ui";

function PasswordFields({ state }: { state: ActionState }) {
  return (
    <>
      <Field label="Password" name="password" type="password" autoComplete="new-password" hint="At least 8 characters" state={state} />
      <Field label="Confirm password" name="confirmPassword" type="password" autoComplete="new-password" state={state} />
    </>
  );
}

function PhoneField({ state, label = "Phone number" }: { state: ActionState; label?: string }) {
  return <Field label={label} name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0803 123 4567" state={state} />;
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
      <fieldset className="space-y-4">
        <legend className="text-xs font-bold tracking-wider text-gray-600 uppercase">Business</legend>
        <Field label="Supermarket name" name="businessName" autoComplete="organization" state={state} />
        <Field label="Business address" name="address" autoComplete="street-address" placeholder="12 Sapele Road" state={state} />
        <Field label="Area" name="area" placeholder="e.g. GRA, Ugbowo, Ring Road" state={state} />
        <LocationFields state={state} />
        <Field label="CAC registration number" name="registrationNumber" hint="Optional, speeds up verification" state={state} />
        <TextArea label="About the supermarket" name="description" hint="Optional" state={state} />
      </fieldset>
      <fieldset className="space-y-4">
        <legend className="text-xs font-bold tracking-wider text-gray-600 uppercase">Contact person &amp; login</legend>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" name="contactFirstName" autoComplete="given-name" state={state} />
          <Field label="Last name" name="contactLastName" autoComplete="family-name" state={state} />
        </div>
        <PhoneField state={state} label="Business phone" />
        <Field label="Business email" name="email" type="email" autoComplete="email" state={state} />
        <PasswordFields state={state} />
      </fieldset>
      <SubmitButton className="w-full" pendingText="Submitting…">
        Submit for approval
      </SubmitButton>
    </form>
  );
}

/** Latitude/longitude inputs with a "use my location" helper. */
export function LocationFields({
  state,
  defaults,
}: {
  state: ActionState;
  defaults?: { latitude: number | null; longitude: number | null };
}) {
  const [coords, setCoords] = useState({
    latitude: state.values?.latitude ?? (defaults?.latitude?.toString() ?? ""),
    longitude: state.values?.longitude ?? (defaults?.longitude?.toString() ?? ""),
  });
  const [status, setStatus] = useState<string | null>(null);

  function useMyLocation() {
    if (!navigator.geolocation) return setStatus("Location isn't available in this browser");
    setStatus("Getting location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) });
        setStatus("Location captured — make sure you're at the store.");
      },
      () => setStatus("Couldn't get your location. Check location permission."),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-2">
        <span className="text-sm font-semibold text-gray-800">Map location</span>
        <button type="button" onClick={useMyLocation} className={buttonClass("secondary", "sm")}>
          <LocateFixed className="h-4 w-4" aria-hidden /> Use my location
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Latitude"
          name="latitude"
          inputMode="decimal"
          value={coords.latitude}
          onChange={(e) => setCoords((c) => ({ ...c, latitude: e.target.value }))}
          state={state}
        />
        <Field
          label="Longitude"
          name="longitude"
          inputMode="decimal"
          value={coords.longitude}
          onChange={(e) => setCoords((c) => ({ ...c, longitude: e.target.value }))}
          state={state}
        />
      </div>
      <p className="text-xs text-gray-500">{status ?? "Lets customers find you and get directions."}</p>
    </div>
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
      <Field label="Plate number" name="plateNumber" placeholder="e.g. BEN 123 AB" autoCapitalize="characters" defaultValue={d("plateNumber")} state={state} />
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
      <fieldset className="space-y-4">
        <legend className="text-xs font-bold tracking-wider text-gray-600 uppercase">About you</legend>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" name="firstName" autoComplete="given-name" state={state} />
          <Field label="Last name" name="lastName" autoComplete="family-name" state={state} />
        </div>
        <PhoneField state={state} />
        <Field label="Email" name="email" type="email" autoComplete="email" state={state} />
        <PasswordFields state={state} />
      </fieldset>
      <fieldset className="space-y-4">
        <legend className="text-xs font-bold tracking-wider text-gray-600 uppercase">Your vehicle</legend>
        <VehicleFields state={state} />
      </fieldset>
      <SubmitButton className="w-full" pendingText="Submitting…">
        Submit for approval
      </SubmitButton>
    </form>
  );
}
