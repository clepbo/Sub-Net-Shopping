"use client";

import { useActionState, useState } from "react";
import { Copy } from "lucide-react";
import { createPosKeyAction, revokePosKeyAction, savePosFeedAction } from "@/app/actions/merchant";
import { Field, FormMessage, SubmitButton } from "../form";
import { buttonClass } from "../ui";

export function PosKeyControls({ hint, endpoint, disabled }: { hint: string | null; endpoint: string; disabled: boolean }) {
  const [state, create] = useActionState(createPosKeyAction, {});
  const [revokeState, revoke] = useActionState(revokePosKeyAction, {});
  const [copied, setCopied] = useState(false);
  const key = state.data?.key;
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Your POS (or your IT provider) sends price and stock changes to <code className="rounded bg-gray-100 px-1 text-xs">{endpoint}</code> with this key.
      </p>
      {key ? (
        <div className="space-y-2 rounded-xl border border-brand-200 bg-brand-50 p-3">
          <p className="text-xs font-bold text-brand-900">Copy this key now. It won&apos;t be shown again.</p>
          <p className="font-mono text-xs break-all">{key}</p>
          <button type="button" className={buttonClass("secondary", "sm")} onClick={() => navigator.clipboard?.writeText(key).then(() => setCopied(true))}>
            <Copy className="h-3.5 w-3.5" aria-hidden /> {copied ? "Copied" : "Copy key"}
          </button>
        </div>
      ) : hint ? (
        <p className="text-sm">
          API key active, ending <span className="font-mono font-bold">…{hint}</span>
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <form action={create}>
          <SubmitButton variant="secondary" size="sm" disabled={disabled} pendingText="Creating…">
            {hint ? "Replace API key" : "Create API key"}
          </SubmitButton>
        </form>
        {hint && !key && (
          <form action={revoke}>
            <SubmitButton variant="ghost" size="sm" disabled={disabled} className="text-red-700" pendingText="…">
              Turn off
            </SubmitButton>
          </form>
        )}
      </div>
      <FormMessage state={state.error ? state : revokeState} />
      <details className="text-xs text-gray-600">
        <summary className="cursor-pointer font-bold">Example request</summary>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-gray-900 p-3 text-[11px] text-gray-100">{`curl -X POST ${endpoint} \\
  -H "Authorization: Bearer snpos_…" \\
  -H "Content-Type: application/json" \\
  -d '{"items":[{"sku":"RICE5","name":"Royal Stallion Rice 5kg","price":9500,"stock":12},
              {"sku":"MILK400","stock":3}]}'`}</pre>
        <p className="mt-1">Prices are your shelf prices in naira. Send just sku and stock (or price) for quick updates.</p>
      </details>
    </div>
  );
}

export function PosFeedForm({ url, disabled }: { url: string | null; disabled: boolean }) {
  const [state, action] = useActionState(savePosFeedAction, {});
  return (
    <form action={action} className="space-y-3" noValidate>
      <Field
        label="Product feed link (CSV)"
        name="posFeedUrl"
        type="url"
        placeholder="https://…/export.csv"
        defaultValue={url ?? ""}
        hint="A link to your POS's scheduled CSV export or a published Google Sheet, in the same columns as the import template. We re-read it every hour."
        disabled={disabled}
        state={state}
      />
      <SubmitButton variant="secondary" size="sm" disabled={disabled} pendingText="Syncing…">
        Save and sync now
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
