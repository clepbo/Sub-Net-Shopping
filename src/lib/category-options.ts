import "server-only";
import { listCategories } from "./catalog";

/** Flat select options with subcategories indented under their parent. */
export async function categoryOptions() {
  const tree = await listCategories();
  return tree.flatMap((c) => [{ value: c.id, label: c.name }, ...c.children.map((s) => ({ value: s.id, label: `— ${s.name}` }))]);
}
