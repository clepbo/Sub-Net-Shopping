"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ListChecks, ListPlus, LocateFixed } from "lucide-react";
import { cx } from "./ui";

/**
 * The shopper's list of products to find in one store. Kept in this browser
 * (no account needed) and mirrored into the /basket URL when they search.
 */
const KEY = "subnet.shoppingList";
const MAX = 30;
const listeners = new Set<() => void>();
let cache: string | null = null;

function read(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function writeList(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...new Set(ids)].slice(0, MAX)));
  } catch {
    // Private mode or storage blocked: the list just won't persist.
  }
  cache = null;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => e.key === KEY && ((cache = null), l());
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

const snapshot = () => (cache ??= (() => {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
})());

export function useShoppingList(): string[] {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "[]");
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

const noopSubscribe = () => () => {};

export function listHref(ids: string[]) {
  return ids.length ? `/basket?items=${ids.join(",")}` : "/basket";
}

/** Adds or removes a product from the list. */
export function ListButton({ productId, className, compact = false }: { productId: string; className?: string; compact?: boolean }) {
  const list = useShoppingList();
  const on = list.includes(productId);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => writeList(on ? read().filter((id) => id !== productId) : [...read(), productId])}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-xl border font-bold transition",
        compact ? "min-h-9 px-3 text-xs" : "min-h-11 px-4 text-sm",
        on ? "border-brand-700 bg-brand-50 text-brand-800" : "border-gray-300 bg-white text-gray-800 hover:border-brand-600",
        className,
      )}
    >
      {on ? <Check className="h-4 w-4" aria-hidden /> : <ListPlus className="h-4 w-4" aria-hidden />}
      {on ? "On your list" : "Add to list"}
    </button>
  );
}

/** Header link to the list, with a count. */
export function ListLink({ className }: { className?: string }) {
  const list = useShoppingList();
  return (
    <Link
      href={listHref(list)}
      className={cx("relative rounded-xl border border-gray-200 p-2 text-brand-800 hover:border-brand-500 hover:bg-brand-50", className)}
      aria-label={list.length ? `Shopping list, ${list.length} items` : "Shopping list"}
      title="Shopping list: find one store with everything"
    >
      <ListChecks className="h-5 w-5" aria-hidden />
      {list.length > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-accent-400 px-1 text-[10px] font-bold text-brand-950">
          {list.length}
        </span>
      )}
    </Link>
  );
}

/**
 * Keeps /basket in step with the stored list (e.g. after removing an item).
 * A shared link with items fills an empty list instead of being cleared.
 */
export function ListSync({ urlIds }: { urlIds: string[] }) {
  const list = useShoppingList();
  const router = useRouter();
  const key = list.join(",");
  const urlKey = urlIds.join(",");
  const adopted = useRef(false);
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  useEffect(() => {
    if (!hydrated || key === urlKey) return;
    if (!adopted.current && list.length === 0 && urlIds.length > 0) {
      adopted.current = true;
      writeList(urlIds);
      return;
    }
    adopted.current = true;
    const params = new URLSearchParams(window.location.search);
    if (list.length) params.set("items", key);
    else params.delete("items");
    router.replace(`/basket${params.size ? `?${params}` : ""}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, key, urlKey]);
  return null;
}

/** Removes one product from the list (and the results). */
export function RemoveFromList({ productId }: { productId: string }) {
  return (
    <button type="button" onClick={() => writeList(read().filter((id) => id !== productId))} className="text-xs font-bold text-red-600 hover:underline">
      Remove
    </button>
  );
}

export function ClearList() {
  return (
    <button type="button" onClick={() => writeList([])} className="text-xs font-bold text-gray-500 hover:underline">
      Clear list
    </button>
  );
}

/** Asks the browser for the shopper's position and puts it in the URL. */
export function UseMyLocation({ active }: { active: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  function locate() {
    if (!navigator.geolocation) return setStatus("Location isn't available in this browser");
    setStatus("Finding you…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const params = new URLSearchParams(window.location.search);
        params.set("lat", p.coords.latitude.toFixed(5));
        params.set("lng", p.coords.longitude.toFixed(5));
        params.delete("near");
        setStatus(null);
        router.replace(`/basket?${params}`, { scroll: false });
      },
      () => setStatus("Couldn't get your location. Allow location access and try again."),
      { enableHighAccuracy: false, timeout: 15_000 },
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" onClick={locate} className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 underline">
        <LocateFixed className="h-4 w-4" aria-hidden /> {active ? "Update my location" : "Use my location"}
      </button>
      {status && <span className="text-xs text-gray-500">{status}</span>}
    </span>
  );
}
