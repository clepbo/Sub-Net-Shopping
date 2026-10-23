"use client";

import { useActionState } from "react";
import { setOnline, updateVehicle } from "@/app/actions/rider";
import { FormMessage, SubmitButton } from "../form";
import { VehicleFields } from "./register-forms";
import { cx } from "../ui";

export function OnlineToggle({ online, canGoOnline }: { online: boolean; canGoOnline: boolean }) {
  const [state, action] = useActionState(setOnline, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="online" value={online ? "false" : "true"} />
      <div className="flex items-center gap-3">
        <span className={cx("h-3 w-3 rounded-full", online ? "animate-pulse bg-brand-500" : "bg-gray-300")} aria-hidden />
        <div className="flex-1">
          <p className="font-bold text-gray-900">{online ? "You're online" : "You're offline"}</p>
          <p className="text-xs text-gray-500">
            {online
              ? "You're available for delivery assignments."
              : canGoOnline
                ? "Go online when you're ready to take deliveries."
                : "You can go online once your account is approved."}
          </p>
        </div>
      </div>
      <SubmitButton
        variant={online ? "secondary" : "primary"}
        disabled={!online && !canGoOnline}
        className="w-full"
        pendingText="Updating…"
      >
        {online ? "Go offline" : "Go online"}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function VehicleForm({ vehicle, disabled }: { vehicle: Record<string, string | null>; disabled: boolean }) {
  const [state, action] = useActionState(updateVehicle, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <fieldset disabled={disabled} className="space-y-4">
        <VehicleFields state={state} defaults={vehicle} />
        <SubmitButton>Save vehicle</SubmitButton>
      </fieldset>
      <FormMessage state={state} />
    </form>
  );
}
