import Link from "next/link";
import type { CategoryTree } from "@/lib/catalog";

export function CategoryTiles({ categories }: { categories: CategoryTree }) {
  return (
    <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid lg:grid-cols-7 lg:overflow-visible lg:px-0">
      {categories.map((c) => (
        <li key={c.id} className="w-24 shrink-0 lg:w-auto">
          <Link
            href={`/categories/${c.slug}`}
            className="flex h-full flex-col items-center gap-2 rounded-2xl border border-brand-100 bg-white p-3 text-center transition hover:border-brand-500 hover:shadow-sm"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-2xl" aria-hidden>
              {c.icon ?? "🛒"}
            </span>
            <span className="text-xs leading-tight font-semibold text-gray-800">{c.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
