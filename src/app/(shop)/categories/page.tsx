import type { Metadata } from "next";
import Link from "next/link";
import { listCategories } from "@/lib/catalog";
import { Page, PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const categories = await listCategories();
  return (
    <Page>
      <PageTitle title="Shop by category" subtitle="Browse products from verified supermarkets across Benin City." />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((c) => (
          <li key={c.id} className="rounded-2xl border border-gray-200 bg-white p-4 transition hover:border-brand-500">
            <Link href={`/categories/${c.slug}`} className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-2xl" aria-hidden>
                {c.icon ?? "🛒"}
              </span>
              <span className="font-bold text-gray-900">{c.name}</span>
            </Link>
            {c.children.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {c.children.map((s) => (
                  <li key={s.id}>
                    <Link href={`/categories/${s.slug}`} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 hover:bg-brand-50">
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </Page>
  );
}
