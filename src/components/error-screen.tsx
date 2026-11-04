"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { buttonClass } from "./ui";

/** Friendly fallback when a page or action fails (e.g. the connection dropped). */
export function ErrorScreen({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div className="p-4">
      <div className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center">
        <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-amber-500" aria-hidden />
        <p className="font-bold text-gray-900">Something went wrong</p>
        <p className="mt-1 text-sm text-gray-600">This is usually a brief connection problem. Please try again.</p>
        <button type="button" onClick={reset} className={`${buttonClass("primary")} mt-4`}>
          Try again
        </button>
        {error.digest && <p className="mt-3 text-[11px] text-gray-400">Reference: {error.digest}</p>}
      </div>
    </div>
  );
}
