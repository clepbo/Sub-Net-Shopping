"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/** Goes back to the previous screen, or to `fallback` when there's no history (e.g. a shared link). */
export function BackButton({ fallback = "/", label = "Back" }: { fallback?: string; label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
      className="flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm font-bold text-brand-800 hover:bg-brand-50"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden /> {label}
    </button>
  );
}
