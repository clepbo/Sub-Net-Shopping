"use client";

import { useActionState } from "react";
import { updatePosIntegration, updateSchedule, updateStoreProfile, uploadLogo } from "@/app/actions/merchant";
import { formatNigerianPhone } from "@/lib/phone";
import { DAY_NAMES } from "@/lib/time";
import type { ActionState } from "@/lib/action-state";
import { Field, FormMessage, Select, SubmitButton, TextArea } from "../form";
import { LocationFields } from "./register-forms";
import { cx } from "../ui";

type Profile = {
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  area: string | null;
  latitude: number | null;
  longitude: number | null;
  registrationNumber: string | null;
  description: string | null;
};

export function StoreProfileForm({ store, disabled }: { store: Profile; disabled: boolean }) {
  const [state, action] = useActionState(updateStoreProfile, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <fieldset disabled={disabled} className="space-y-4">
        <Field label="Supermarket name" name="name" defaultValue={store.name} state={state} />
        <Field label="Contact person" name="contactName" defaultValue={store.contactName} state={state} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Business phone" name="phone" type="tel" defaultValue={formatNigerianPhone(store.phone)} state={state} />
          <Field label="Business email" name="email" type="email" defaultValue={store.email} state={state} />
        </div>
        <Field label="Address" name="address" defaultValue={store.address} state={state} />
        <Field label="Area" name="area" defaultValue={store.area ?? ""} placeholder="e.g. GRA" state={state} />
        <LocationFields state={state} defaults={{ latitude: store.latitude, longitude: store.longitude }} />
        <Field label="CAC registration number" name="registrationNumber" defaultValue={store.registrationNumber ?? ""} state={state} />
        <TextArea label="About the supermarket" name="description" defaultValue={store.description ?? ""} state={state} />
        <SubmitButton>Save profile</SubmitButton>
      </fieldset>
      <FormMessage state={state} />
    </form>
  );
}

export function LogoForm({ disabled }: { disabled: boolean }) {
  const [state, action] = useActionState(uploadLogo, {});
  return (
    <form action={action} className="space-y-3">
      <fieldset disabled={disabled} className="space-y-3">
        <input
          type="file"
          name="logo"
          accept="image/jpeg,image/png,image/webp"
          aria-label="Logo image"
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-semibold file:text-brand-800"
        />
        <p className="text-xs text-gray-500">JPG, PNG or WebP, up to 2 MB. A square image works best.</p>
        <SubmitButton variant="secondary" size="sm" pendingText="Uploading…">
          Upload logo
        </SubmitButton>
      </fieldset>
      <FormMessage state={state} />
    </form>
  );
}

export function PosForm({
  pos,
  disabled,
}: {
  pos: { posProvider: string | null; posHasApi: boolean | null; posIntegrationNotes: string | null };
  disabled: boolean;
}) {
  const [state, action] = useActionState(updatePosIntegration, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <fieldset disabled={disabled} className="space-y-4">
        <Field
          label="POS / inventory system"
          name="posProvider"
          defaultValue={pos.posProvider ?? ""}
          placeholder="e.g. Odoo, QuickBooks POS, custom"
          state={state}
        />
        <Select
          label="Does it offer an API?"
          name="posHasApi"
          defaultValue={pos.posHasApi === null ? "unknown" : pos.posHasApi ? "yes" : "no"}
          options={[
            { value: "unknown", label: "Not sure" },
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ]}
          state={state}
        />
        <TextArea
          label="Notes for our integration team"
          name="posIntegrationNotes"
          defaultValue={pos.posIntegrationNotes ?? ""}
          hint="Vendor contact, export options, whether it stores barcodes and images…"
          state={state}
        />
        <SubmitButton variant="secondary">Save POS details</SubmitButton>
      </fieldset>
      <FormMessage state={state} />
    </form>
  );
}

type Schedule = {
  hours: { dayOfWeek: number; isOpen: boolean; opensAt: string | null; closesAt: string | null }[];
  lastOrderTime: string | null;
  pickupEnabled: boolean;
  pickupStart: string | null;
  pickupEnd: string | null;
  deliveryEnabled: boolean;
  deliveryStart: string | null;
  deliveryEnd: string | null;
  lastDeliveryOrderTime: string | null;
};

function TimeInput({ name, label, defaultValue, state }: { name: string; label: string; defaultValue: string | null; state: ActionState }) {
  return (
    <label className="block text-xs font-semibold text-gray-700">
      {label}
      <input
        type="time"
        name={name}
        defaultValue={state.values?.[name] ?? defaultValue ?? ""}
        className="mt-1 block w-full rounded-xl border border-gray-300 px-2 py-2 text-sm"
      />
    </label>
  );
}

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm font-semibold text-gray-900">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-5 w-5 rounded accent-brand-700" />
      {label}
    </label>
  );
}

export function ScheduleForm({ schedule, disabled }: { schedule: Schedule; disabled: boolean }) {
  const [state, action] = useActionState(updateSchedule, {});
  const v = state.values;
  // After a submit, the echoed values are the source of truth (unchecked boxes are absent).
  const checked = (name: string, fallback: boolean) => (v ? v[name] === "on" : fallback);
  const err = (name: string) => state.fieldErrors?.[name];

  return (
    <form action={action} className="space-y-5" noValidate>
      <fieldset disabled={disabled} className="space-y-5">
        <section>
          <h2 className="mb-2 text-xs font-bold tracking-wider text-gray-600 uppercase">Store hours</h2>
          <ul className="space-y-2">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const h = schedule.hours.find((x) => x.dayOfWeek === d);
              return (
                <li key={d} className={cx("rounded-xl border p-2", err(`day${d}`) ? "border-red-400 bg-red-50" : "border-gray-200")}>
                  <div className="flex items-center gap-1.5">
                    <label className="flex w-14 shrink-0 items-center gap-1.5 text-sm font-semibold">
                      <input
                        type="checkbox"
                        name={`day${d}.isOpen`}
                        defaultChecked={checked(`day${d}.isOpen`, h?.isOpen ?? false)}
                        className="h-5 w-5 accent-brand-700"
                      />
                      {DAY_NAMES[d].slice(0, 3)}
                    </label>
                    <input
                      type="time"
                      name={`day${d}.opensAt`}
                      aria-label={`${DAY_NAMES[d]} opening time`}
                      defaultValue={v?.[`day${d}.opensAt`] ?? h?.opensAt ?? ""}
                      className="w-0 min-w-0 flex-1 rounded-lg border border-gray-300 px-1 py-1.5 text-sm"
                    />
                    <span className="text-gray-400">–</span>
                    <input
                      type="time"
                      name={`day${d}.closesAt`}
                      aria-label={`${DAY_NAMES[d]} closing time`}
                      defaultValue={v?.[`day${d}.closesAt`] ?? h?.closesAt ?? ""}
                      className="w-0 min-w-0 flex-1 rounded-lg border border-gray-300 px-1 py-1.5 text-sm"
                    />
                  </div>
                  {err(`day${d}`) && <p className="mt-1 text-xs font-medium text-red-600">{err(`day${d}`)}</p>}
                </li>
              );
            })}
          </ul>
          <div className="mt-3 max-w-48">
            <TimeInput name="lastOrderTime" label="Last order time (daily)" defaultValue={schedule.lastOrderTime} state={state} />
          </div>
        </section>

        <section className="space-y-3 border-t border-gray-100 pt-4">
          <Toggle name="pickupEnabled" label="Offer Reserve & Pick Up" defaultChecked={checked("pickupEnabled", schedule.pickupEnabled)} />
          <div className="grid grid-cols-2 gap-3">
            <TimeInput name="pickupStart" label="Pickup from" defaultValue={schedule.pickupStart} state={state} />
            <TimeInput name="pickupEnd" label="Pickup until" defaultValue={schedule.pickupEnd} state={state} />
          </div>
          {err("pickupStart") ? (
            <p className="text-xs font-medium text-red-600">{err("pickupStart")}</p>
          ) : (
            <p className="text-xs text-gray-500">Leave blank to allow pickup whenever the store is open.</p>
          )}
        </section>

        <section className="space-y-3 border-t border-gray-100 pt-4">
          <Toggle name="deliveryEnabled" label="Offer delivery" defaultChecked={checked("deliveryEnabled", schedule.deliveryEnabled)} />
          <div className="grid grid-cols-2 gap-3">
            <TimeInput name="deliveryStart" label="Delivery from" defaultValue={schedule.deliveryStart} state={state} />
            <TimeInput name="deliveryEnd" label="Delivery until" defaultValue={schedule.deliveryEnd} state={state} />
          </div>
          {err("deliveryStart") && <p className="text-xs font-medium text-red-600">{err("deliveryStart")}</p>}
          <div className="max-w-48">
            <TimeInput name="lastDeliveryOrderTime" label="Last delivery order" defaultValue={schedule.lastDeliveryOrderTime} state={state} />
          </div>
        </section>

        <SubmitButton className="w-full">Save hours</SubmitButton>
      </fieldset>
      <FormMessage state={state} />
    </form>
  );
}
