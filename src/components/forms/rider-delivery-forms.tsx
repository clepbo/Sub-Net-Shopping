"use client";

import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};
import { acceptDeliveryAction, completeDeliveryAction, pickedUpAction, releaseDeliveryAction, shareLocation } from "@/app/actions/rider";
import { FormMessage, SubmitButton } from "../form";

export function AcceptButton({ orderId }: { orderId: string }) {
  const [state, action] = useActionState(acceptDeliveryAction, {});
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="orderId" value={orderId} />
      <SubmitButton className="w-full" pendingText="Accepting…">
        Accept delivery
      </SubmitButton>
      {state.error && <p className="text-xs font-medium text-red-600">{state.error}</p>}
    </form>
  );
}

export function PickedUpButton({ assignmentId }: { assignmentId: string }) {
  const [state, action] = useActionState(pickedUpAction, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <SubmitButton className="w-full" pendingText="Updating…">
        I&apos;ve picked up the order
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function HandBackButton({ assignmentId }: { assignmentId: string }) {
  const [state, action] = useActionState(releaseDeliveryAction, {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Hand this delivery back so another rider can take it?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <SubmitButton variant="ghost" size="sm" className="text-red-700" pendingText="…">
        Hand back delivery
      </SubmitButton>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

export function DeliveredForm({ assignmentId }: { assignmentId: string }) {
  const [state, action] = useActionState(completeDeliveryAction, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <label className="block text-sm font-semibold text-gray-800">
        Customer&apos;s delivery PIN
        <input
          name="pin"
          inputMode="numeric"
          autoComplete="off"
          maxLength={7}
          placeholder="000000"
          className="mt-1 h-12 w-full rounded-xl border border-gray-300 px-3 text-center font-mono text-2xl tracking-[0.3em]"
        />
      </label>
      <SubmitButton className="w-full" pendingText="Checking…">
        Confirm delivered
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

/** Sends the rider's GPS position to Sub Net every ~15 s while this is on screen. */
export function LocationSharer() {
  // Read on the client only: Node also has a `navigator`, but without geolocation,
  // so checking it during render would make the server and phone disagree.
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => Boolean(navigator.geolocation),
    () => true,
  );
  const [status, setStatus] = useState("Starting location sharing…");
  const last = useRef(0);
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - last.current < 15_000) return;
        last.current = now;
        void shareLocation(pos.coords.latitude, pos.coords.longitude);
        setStatus(`Sharing your location · updated ${new Date().toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })}`);
      },
      () => setStatus("Allow location access so customers can follow their delivery."),
      { enableHighAccuracy: true, maximumAge: 10_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);
  return <p className="text-xs text-gray-500">{supported ? status : "Location isn't available on this device, so customers can't see you on the map."}</p>;
}
