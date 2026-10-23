"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cx } from "./ui";

type Option = { value: string; label: string };

/**
 * Sort and filter controls that update the URL, so filtered pages are
 * shareable and work with the back button.
 */
export function ProductFilters({
  sorts,
  categories,
  stores,
  className,
}: {
  sorts: Option[];
  categories?: Option[];
  stores?: Option[];
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  const select = "h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900";
  return (
    <div className={cx("-mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0 [&>*]:shrink-0", pending && "opacity-60", className)}>
      {categories && (
        <select aria-label="Category" className={select} value={params.get("category") ?? ""} onChange={(e) => update("category", e.target.value)}>
          <option value="">All categories</option>
          {categories.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      {stores && (
        <select aria-label="Supermarket" className={select} value={params.get("store") ?? ""} onChange={(e) => update("store", e.target.value)}>
          <option value="">All supermarkets</option>
          {stores.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      <select aria-label="Sort by" className={select} value={params.get("sort") ?? "relevance"} onChange={(e) => update("sort", e.target.value === "relevance" ? "" : e.target.value)}>
        {sorts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <label className="flex h-10 items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 text-sm font-medium whitespace-nowrap text-gray-800">
        <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={params.get("instock") === "1"} onChange={(e) => update("instock", e.target.checked ? "1" : "")} />
        In stock only
      </label>
    </div>
  );
}
