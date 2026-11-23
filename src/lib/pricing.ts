import "server-only";
import { db } from "./db";
import { getSettings } from "./settings";
import { customerPrice, markupFor } from "./pricing-math";
import { Prisma } from "@/generated/prisma/client";

type Client = Prisma.TransactionClient | typeof db;

export async function defaultMarkup() {
  return Number((await getSettings()).defaultMarkupPercent) || 0;
}

/** Customer price and stored shelf price for a store's listing of a product. */
export async function listingPrices(client: Client, productId: string, shelfKobo: number, fallbackPercent?: number) {
  const product = await client.product.findUnique({
    where: { id: productId },
    select: { category: { select: { markupPercent: true, parent: { select: { markupPercent: true } } } } },
  });
  const percent = markupFor(product?.category ?? null, fallbackPercent ?? (await defaultMarkup()));
  return { shelfPriceKobo: shelfKobo, priceKobo: customerPrice(shelfKobo, percent), markupPercent: percent };
}

/**
 * Recomputes every listing's customer price from its shelf price, after an
 * admin changes markups. Same rounding as customerPrice (kept in step by the
 * pricing tests).
 */
export async function repriceAll() {
  const percent = await defaultMarkup();
  return db.$executeRaw`
    UPDATE "Inventory" i SET "priceKobo" = GREATEST(i."shelfPriceKobo", (
      SELECT CEIL(m.raw / m.step - 1e-9) * m.step
      FROM (SELECT x.raw, CASE WHEN x.raw < 50000 THEN 1000 WHEN x.raw < 500000 THEN 5000 ELSE 10000 END AS step
            FROM (SELECT i."shelfPriceKobo" * (1 + COALESCE(c."markupPercent", pc."markupPercent", ${percent}::float8) / 100.0) AS raw) x) m
    ))::int
    FROM "Product" p
    LEFT JOIN "Category" c ON c."id" = p."categoryId"
    LEFT JOIN "Category" pc ON pc."id" = c."parentId"
    WHERE p."id" = i."productId" AND i."shelfPriceKobo" IS NOT NULL`;
}
