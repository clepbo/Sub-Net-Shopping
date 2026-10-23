import Link from "next/link";
import { cx } from "./ui";

export function FilterTabs({ base, current, tabs }: { base: string; current: string; tabs: { value: string; label: string; count?: number }[] }) {
  return (
    <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Filter">
      {tabs.map((t) => {
        const active = t.value === current;
        return (
          <Link
            key={t.value}
            href={t.value ? `${base}?status=${t.value}` : base}
            aria-current={active ? "page" : undefined}
            className={cx(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold",
              active ? "border-brand-700 bg-brand-700 text-white" : "border-gray-300 bg-white text-gray-700",
            )}
          >
            {t.label}
            {t.count !== undefined && <span className="ml-1 opacity-75">{t.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
