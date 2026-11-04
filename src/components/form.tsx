"use client";

import { useFormStatus } from "react-dom";
import { useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { buttonClass, cx, type ButtonVariant } from "./ui";
import type { ActionState } from "@/lib/action-state";

export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { pendingText?: string; variant?: ButtonVariant; size?: "md" | "sm" }) {
  const { pending } = useFormStatus();
  return (
    <button {...props} type="submit" disabled={pending || props.disabled} className={cx(buttonClass(variant, size), className)}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {pendingText ?? "Saving…"}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState | undefined }) {
  const ref = useRef<HTMLDivElement>(null);
  const invalidCount = Object.keys(state?.fieldErrors ?? {}).length;

  // After a failed submit, bring the first problem into view so it's never missed.
  useEffect(() => {
    if (!state || (!state.error && !invalidCount)) return;
    const form = ref.current?.closest("form");
    const target = form?.querySelector<HTMLElement>("[aria-invalid=true]") ?? ref.current;
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) target.focus({ preventScroll: true });
  }, [state, invalidCount]);

  if (!state) return null;
  if (!state.error && invalidCount > 0) {
    return (
      <div ref={ref} role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
        Please fix {invalidCount === 1 ? "the highlighted field" : `the ${invalidCount} highlighted fields`}.
      </div>
    );
  }
  if (state.error) {
    return (
      <div ref={ref} role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
        {state.error}
      </div>
    );
  }
  if (state.ok) {
    return (
      <p role="status" className="rounded-xl bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800">
        {state.ok}
      </p>
    );
  }
  return null;
}

const inputClass =
  "block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder:text-gray-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 focus:outline-none aria-invalid:border-red-500";

type FieldProps = {
  label: string;
  name: string;
  state?: ActionState;
  hint?: ReactNode;
  className?: string;
};

function FieldShell({ label, name, state, hint, className, children }: FieldProps & { children: ReactNode }) {
  const error = state?.fieldErrors?.[name];
  return (
    <div className={className}>
      <label htmlFor={name} className="mb-1 block text-sm font-semibold text-gray-800">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${name}-error`} className="mt-1 text-xs font-medium text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-gray-500">{hint}</p>
      ) : null}
    </div>
  );
}

/** Text input that keeps its value after a failed submit. */
export function Field({
  label,
  name,
  state,
  hint,
  className,
  defaultValue,
  ...props
}: FieldProps & Omit<ComponentProps<"input">, "name">) {
  const error = state?.fieldErrors?.[name];
  const value = state?.values?.[name] ?? defaultValue;
  return (
    <FieldShell label={label} name={name} state={state} hint={hint} className={className}>
      <input
        id={name}
        name={name}
        defaultValue={props.type === "password" || props.value !== undefined ? undefined : (value as string | undefined)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        className={inputClass}
        {...props}
      />
    </FieldShell>
  );
}

export function TextArea({
  label,
  name,
  state,
  hint,
  className,
  defaultValue,
  ...props
}: FieldProps & Omit<ComponentProps<"textarea">, "name">) {
  const error = state?.fieldErrors?.[name];
  return (
    <FieldShell label={label} name={name} state={state} hint={hint} className={className}>
      <textarea
        id={name}
        name={name}
        rows={3}
        defaultValue={(state?.values?.[name] ?? defaultValue) as string | undefined}
        aria-invalid={error ? true : undefined}
        className={inputClass}
        {...props}
      />
    </FieldShell>
  );
}

export function Select({
  label,
  name,
  state,
  hint,
  className,
  defaultValue,
  options,
  ...props
}: FieldProps & Omit<ComponentProps<"select">, "name"> & { options: { value: string; label: string }[] }) {
  const error = state?.fieldErrors?.[name];
  const value = (state?.values?.[name] ?? defaultValue) as string | undefined;
  return (
    <FieldShell label={label} name={name} state={state} hint={hint} className={className}>
      <select
        // React only applies a select's defaultValue on mount, and a form
        // action resets the form afterwards, so remount to keep the submitted choice.
        key={value}
        id={name}
        name={name}
        defaultValue={value}
        aria-invalid={error ? true : undefined}
        className={inputClass}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
