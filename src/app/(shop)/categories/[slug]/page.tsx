import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { categoryFilterIds, findCategory } from "@/lib/catalog";
import { storeOptions } from "@/lib/stores-list";
import { ProductBrowser, parseBrowse, type BrowseParams } from "@/components/product-browser";
import { Page } from "@/components/ui";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<BrowseParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = await findCategory((await params).slug);
  return { title: category?.name ?? "Category" };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const category = await findCategory(slug);
  if (!category) notFound();
  const { sort, inStockOnly, page } = parseBrowse(sp);

  return (
    <Page>
      <nav className="text-xs text-gray-500" aria-label="Breadcrumb">
        <Link href="/categories" className="hover:underline">
          Categories
        </Link>
        {category.parent && (
          <>
            {" / "}
            <Link href={`/categories/${category.parent.slug}`} className="hover:underline">
              {category.parent.name}
            </Link>
          </>
        )}
      </nav>
      <h1 className="flex items-center gap-2 text-2xl font-extrabold">
        <span aria-hidden>{category.icon}</span> {category.name}
      </h1>
      {category.children.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {category.children.map((c) => (
            <li key={c.id}>
              <Link href={`/categories/${c.slug}`} className="rounded-full border border-gray-300 bg-white px-3 py-1 text-sm hover:border-brand-500">
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <ProductBrowser
        options={{ categoryIds: categoryFilterIds(category), supermarketId: sp.store, sort, inStockOnly, page }}
        params={sp}
        basePath={`/categories/${slug}`}
        stores={await storeOptions()}
        emptyTitle={`No ${category.name.toLowerCase()} listed yet`}
        emptyHint="Supermarkets are adding their products. Check back soon."
      />
    </Page>
  );
}
