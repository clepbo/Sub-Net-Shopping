"use client";

import { useActionState, useState } from "react";
import { Copy, MessageCircle } from "lucide-react";
import { addStaff, changeStaffRole, removeStaff, resendStaffInvite } from "@/app/actions/staff";
import type { ActionState } from "@/lib/action-state";
import { Field, FormMessage, Select, SubmitButton } from "../form";
import { buttonClass } from "../ui";

const ROLE_OPTIONS = [
  { value: "STAFF", label: "Staff: orders, pickup and stock" },
  { value: "MANAGER", label: "Manager: everything, including staff and payouts" },
];

/** Shows the invite link so the manager can also send it on WhatsApp. */
function InviteLink({ state }: { state: ActionState }) {
  const [copied, setCopied] = useState(false);
  const link = state.data?.link;
  if (!link) return null;
  const text = `Hi ${state.data?.name}, set your SubNet staff password here: ${link}`;
  return (
    <div className="space-y-2 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm">
      <p className="font-semibold text-brand-900">You can also send them the link yourself:</p>
      <p className="truncate rounded-lg bg-white px-2 py-1 font-mono text-xs">{link}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonClass("secondary", "sm")}
          onClick={() => navigator.clipboard?.writeText(link).then(() => setCopied(true))}
        >
          <Copy className="h-3.5 w-3.5" aria-hidden /> {copied ? "Copied" : "Copy link"}
        </button>
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className={buttonClass("secondary", "sm")}>
          <MessageCircle className="h-3.5 w-3.5" aria-hidden /> Send on WhatsApp
        </a>
      </div>
    </div>
  );
}

export function AddStaffForm() {
  const [state, action] = useActionState(addStaff, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <InviteLink state={state} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" name="firstName" state={state} />
        <Field label="Last name" name="lastName" state={state} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Phone number" name="phone" type="tel" inputMode="tel" placeholder="0803 123 4567" state={state} />
        <Field label="Email" name="email" type="email" hint="Their login. We email them a link to set a password." state={state} />
      </div>
      <Select label="Role" name="role" options={ROLE_OPTIONS} defaultValue="STAFF" state={state} />
      <SubmitButton pendingText="Adding…">Add staff member</SubmitButton>
    </form>
  );
}

export function StaffRowActions({ memberId, role, pending }: { memberId: string; role: "STAFF" | "MANAGER"; pending: boolean }) {
  const [roleState, roleAction] = useActionState(changeStaffRole, {});
  const [removeState, removeAction] = useActionState(removeStaff, {});
  const [inviteState, inviteAction] = useActionState(resendStaffInvite, {});
  const msg = removeState.error ?? roleState.error ?? inviteState.error ?? roleState.ok ?? inviteState.ok;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <form action={roleAction}>
          <input type="hidden" name="memberId" value={memberId} />
          <input type="hidden" name="role" value={role === "MANAGER" ? "STAFF" : "MANAGER"} />
          <SubmitButton variant="secondary" size="sm" pendingText="Saving…">
            {role === "MANAGER" ? "Make staff" : "Make manager"}
          </SubmitButton>
        </form>
        {pending && (
          <form action={inviteAction}>
            <input type="hidden" name="memberId" value={memberId} />
            <SubmitButton variant="secondary" size="sm" pendingText="Sending…">
              Resend invite
            </SubmitButton>
          </form>
        )}
        <form
          action={removeAction}
          onSubmit={(e) => {
            if (!confirm("Remove this person? They won't be able to sign in any more.")) e.preventDefault();
          }}
        >
          <input type="hidden" name="memberId" value={memberId} />
          <SubmitButton variant="danger" size="sm" pendingText="Removing…">
            Remove
          </SubmitButton>
        </form>
      </div>
      {msg && <p className="text-xs font-medium text-gray-600">{msg}</p>}
      <InviteLink state={inviteState} />
    </div>
  );
}
