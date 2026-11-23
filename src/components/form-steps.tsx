"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import type { ActionState } from "@/lib/action-state";
import { buttonClass, cx } from "./ui";
import { SubmitButton } from "./form";

export type FormStep = {
  title: string;
  /** Field names on this step, so a server error can reopen the right step. */
  fields: string[];
  content: ReactNode;
};

/**
 * Splits one form into steps. Every step stays in the page (only hidden), so the
 * whole form is submitted at the end and a failed submit can't lose earlier answers.
 */
export function FormSteps({
  steps,
  state,
  submitLabel,
  pendingText,
}: {
  steps: FormStep[];
  state: ActionState;
  submitLabel: string;
  pendingText: string;
}) {
  const [current, setCurrent] = useState(0);
  const panels = useRef<(HTMLDivElement | null)[]>([]);
  const top = useRef<HTMLOListElement>(null);

  // After a failed submit, open the first step that has a problem.
  useEffect(() => {
    const bad = Object.keys(state.fieldErrors ?? {});
    if (!bad.length) return;
    const idx = steps.findIndex((s) => s.fields.some((f) => bad.includes(f)));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- responds to a new server result
    if (idx >= 0) setCurrent(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function go(to: number) {
    setCurrent(to);
    top.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function next() {
    // Check required fields on this step before moving on.
    const panel = panels.current[current];
    const inputs = panel ? Array.from(panel.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input,select,textarea")) : [];
    for (const el of inputs) {
      if (!el.checkValidity()) {
        el.reportValidity();
        el.focus();
        return;
      }
    }
    go(current + 1);
  }

  const last = current === steps.length - 1;
  return (
    <div className="space-y-5">
      <ol ref={top} className="flex items-center gap-2" aria-label="Steps">
        {steps.map((s, i) => (
          <li key={s.title} className="flex flex-1 items-center gap-2">
            <span
              className={cx(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
                i < current ? "bg-brand-700 text-white" : i === current ? "bg-accent-400 text-brand-950" : "bg-gray-100 text-gray-500",
              )}
              aria-current={i === current ? "step" : undefined}
            >
              {i < current ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
            </span>
            <span className={cx("hidden text-xs font-bold sm:block", i === current ? "text-gray-900" : "text-gray-500")}>{s.title}</span>
            {i < steps.length - 1 && <span className="h-px flex-1 bg-gray-200" aria-hidden />}
          </li>
        ))}
      </ol>
      <p className="text-sm font-bold text-gray-900 sm:hidden">
        Step {current + 1} of {steps.length}: {steps[current].title}
      </p>

      {steps.map((s, i) => (
        <div
          key={s.title}
          ref={(el) => {
            panels.current[i] = el;
          }}
          hidden={i !== current}
          className="space-y-4"
        >
          {s.content}
        </div>
      ))}

      <div className="flex gap-3">
        {current > 0 && (
          <button type="button" onClick={() => go(current - 1)} className={buttonClass("secondary")}>
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back
          </button>
        )}
        {last ? (
          <SubmitButton className="flex-1" pendingText={pendingText}>
            {submitLabel}
          </SubmitButton>
        ) : (
          <button type="button" onClick={next} className={cx(buttonClass("primary"), "flex-1")}>
            Continue <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
