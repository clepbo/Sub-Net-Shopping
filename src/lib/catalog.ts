import "server-only";
import { cache } from "react";
import { db } from "./db";
import { Prisma } from "@/generated/prisma/client";
import { VISIBLE_AVAILABILITY } from "./inventory";

/** Top-level categories with their subcategories, in display order. */
export const listCategories = cache(async () => {
  return db.category.findMany({
    where: { parentId: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { children: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
  });
});

export type CategoryTree = Awaited<ReturnType<typeof listCategories>>;

export async function findCategory(slug: string) {
  return db.category.findUnique({ where: { slug }, include: { children: true, parent: true } });
}

export const SORTS = {
  relevance: "Best match",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  newest: "Newest",
} as const;
export type Sort = keyof typeof SORTS;

export type ProductSummary = {
  id: string;
  name: string;
  brand: string | null;
  unit: string | null;
  image: string | null;
  minPriceKobo: number;
  maxPriceKobo: number;
  /** Supermarkets listing it. */
  offers: number;
  /** Supermarkets with it in stock. */
  inStockOffers: number;
};

export type BrowseOptions = {
  q?: string;
  categoryIds?: string[];
  supermarketId?: string;
  inStockOnly?: boolean;
  sort?: Sort;
  page?: number;
  pageSize?: number;
};

/**
 * Products customers can see — listed by an approved supermarket and not
 * hidden — grouped across stores so each appears once with its price range.
 */
export async function browseProducts(opts: BrowseOptions): Promise<{ items: ProductSummary[]; total: number }> {
  const pageSize = opts.pageSize ?? 24;
  const page = Math.max(1, opts.page ?? 1);
  const visible = Prisma.join(VISIBLE_AVAILABILITY.map((a) => Prisma.sql`${a}::"Availability"`));

  const where: Prisma.Sql[] = [Prisma.sql`s."status" = 'APPROVED'`, Prisma.sql`i."availability" IN (${visible})`];
  if (opts.supermarketId) where.push(Prisma.sql`i."supermarketId" = ${opts.supermarketId}`);
  if (opts.categoryIds?.length) where.push(Prisma.sql`p."categoryId" IN (${Prisma.join(opts.categoryIds)})`);
  const terms = (opts.q ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 6);
  if (terms.length) {
    const words = terms.map((t) => {
      const like = `%${t.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      return Prisma.sql`(p."name" ILIKE ${like} OR p."brand" ILIKE ${like})`;
    });
    const barcode = opts.q!.trim();
    where.push(Prisma.sql`((${Prisma.join(words, " AND ")}) OR p."barcode" = ${barcode})`);
  }

  // Postgres can't use output aliases inside ORDER BY expressions, so the
  // aggregates are repeated here.
  const inStock = Prisma.sql`count(*) FILTER (WHERE i."availability" <> 'OUT_OF_STOCK')`;
  const order = {
    relevance: Prisma.sql`(${inStock} > 0) DESC, count(*) DESC, p."name" ASC`,
    price_asc: Prisma.sql`min(i."priceKobo") ASC, p."name" ASC`,
    price_desc: Prisma.sql`min(i."priceKobo") DESC, p."name" ASC`,
    newest: Prisma.sql`p."createdAt" DESC`,
  }[opts.sort ?? "relevance"];

  const base = Prisma.sql`
    FROM "Product" p
    JOIN "Inventory" i ON i."productId" = p."id"
    JOIN "Supermarket" s ON s."id" = i."supermarketId"
    WHERE ${Prisma.join(where, " AND ")}
    GROUP BY p."id"
    ${opts.inStockOnly ? Prisma.sql`HAVING ${inStock} > 0` : Prisma.empty}`;

  const [items, count] = await Promise.all([
    db.$queryRaw<ProductSummary[]>`
      SELECT p."id", p."name", p."brand", p."unit",
        (SELECT pi."url" FROM "ProductImage" pi WHERE pi."productId" = p."id"
           ORDER BY pi."sortOrder", pi."createdAt" LIMIT 1) AS "image",
        min(i."priceKobo")::int AS "minPriceKobo",
        max(i."priceKobo")::int AS "maxPriceKobo",
        count(*)::int AS "offers",
        (${inStock})::int AS "inStockOffers"
      ${base}
      ORDER BY ${order}
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
    db.$queryRaw<{ total: number }[]>`SELECT count(*)::int AS "total" FROM (SELECT p."id" ${base}) t`,
  ]);
  return { items, total: count[0]?.total ?? 0 };
}

/** A product with every approved supermarket's offer, cheapest first. */
export async function getProductWithOffers(id: string) {
  const product = await db.product.findUnique({
    where: { id },
    include: {
      category: { include: { parent: true } },
      images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      inventory: {
        where: { availability: { in: VISIBLE_AVAILABILITY }, supermarket: { status: "APPROVED" } },
        orderBy: { priceKobo: "asc" },
        include: { supermarket: { include: { hours: { orderBy: { dayOfWeek: "asc" } } } } },
      },
    },
  });
  if (!product || product.inventory.length === 0) return null;
  return product;
}

/** Category IDs to filter by: the category plus its subcategories. */
export function categoryFilterIds(category: { id: string; children: { id: string }[] }) {
  return [category.id, ...category.children.map((c) => c.id)];
}

/** Top-level categories that currently have visible products, with a preview of each. */
export async function homeRails(limitPerRail = 10, maxRails = 6) {
  const categories = await listCategories();
  const rails = await Promise.all(
    categories.map(async (c) => ({
      category: c,
      ...(await browseProducts({ categoryIds: categoryFilterIds(c), pageSize: limitPerRail, sort: "relevance" })),
    })),
  );
  return rails.filter((r) => r.items.length > 0).slice(0, maxRails);
}
