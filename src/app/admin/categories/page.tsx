import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { CategoryForm, DeleteCategoryButton } from "@/components/forms/category-forms";
import { Card, Page, PageTitle, SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Categories" };

export default async function AdminCategories() {
  await requireUser("ADMIN");
  const categories = await db.category.findMany({
    where: { parentId: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { products: true } },
      children: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { products: true } } } },
    },
  });
  const parents = categories.map((c) => ({ value: c.id, label: c.name }));

  return (
    <Page>
      <PageTitle eyebrow="Admin" title="Categories" subtitle="Departments shoppers browse by. Two levels: categories and subcategories." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <ul className="space-y-3">
          {categories.map((c) => (
            <li key={c.id}>
              <Card>
                <details>
                  <summary className="flex cursor-pointer items-center justify-between gap-3">
                    <span className="font-bold">
                      <span aria-hidden>{c.icon}</span> {c.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {c._count.products} products{c.children.length ? ` · ${c.children.length} subcategories` : ""}
                    </span>
                  </summary>
                  <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
                    <CategoryForm category={c} parents={parents} />
                    <DeleteCategoryButton id={c.id} name={c.name} />
                  </div>
                </details>
                {c.children.length > 0 && (
                  <ul className="mt-3 space-y-2 border-l-2 border-brand-100 pl-3">
                    {c.children.map((s) => (
                      <li key={s.id}>
                        <details>
                          <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm">
                            <span>
                              <span aria-hidden>{s.icon}</span> {s.name}
                            </span>
                            <span className="text-xs text-gray-500">{s._count.products} products</span>
                          </summary>
                          <div className="mt-3 space-y-3">
                            <CategoryForm category={s} parents={parents} />
                            <DeleteCategoryButton id={s.id} name={s.name} />
                          </div>
                        </details>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </li>
          ))}
        </ul>
        <Card className="lg:sticky lg:top-24">
          <SectionTitle>Add a category</SectionTitle>
          <CategoryForm parents={parents} />
        </Card>
      </div>
    </Page>
  );
}
