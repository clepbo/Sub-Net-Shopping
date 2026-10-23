import "server-only";
import { db } from "./db";

/** Approved supermarkets as filter options. */
export async function storeOptions() {
  const stores = await db.supermarket.findMany({ where: { status: "APPROVED" }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  return stores.map((s) => ({ value: s.id, label: s.name }));
}
