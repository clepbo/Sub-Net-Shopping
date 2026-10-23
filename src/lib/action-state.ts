import type { FieldErrors } from "./validation";

/** Shape returned by every form server action. */
export type ActionState = {
  ok?: string;
  error?: string;
  fieldErrors?: FieldErrors;
  /** Submitted values, echoed back so fields keep their input after an error. */
  values?: Record<string, string>;
};

/** Plain string values from FormData (files and passwords excluded). */
export function formValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !/password/i.test(key) && !key.startsWith("$")) out[key] = value;
  }
  return out;
}
