// Turns a product CSV (e.g. exported from a store's POS) into listing
// updates. Validation is per row so one bad line doesn't block the rest.
import { parseCsv } from "./csv";
import { parseNairaToKobo, type ImportItem } from "./inventory";

export const CSV_COLUMNS = ["sku", "name", "price", "stock", "barcode", "category", "brand", "unit", "description"] as const;
export const CSV_TEMPLATE =
  "sku,name,price,stock,barcode,category,brand,unit,description\n" +
  'IND-001,Indomie Chicken Noodles,900,50,0012345678905,Groceries & Staples,Indomie,70g,"Instant noodles, chicken flavour"\n';
export const MAX_IMPORT_ROWS = 2000;

const ALIASES: Record<string, (typeof CSV_COLUMNS)[number]> = {
  sku: "sku",
  code: "sku",
  "product code": "sku",
  item_code: "sku",
  name: "name",
  "product name": "name",
  description: "description",
  price: "price",
  "selling price": "price",
  "unit price": "price",
  stock: "stock",
  qty: "stock",
  quantity: "stock",
  "stock quantity": "stock",
  barcode: "barcode",
  ean: "barcode",
  upc: "barcode",
  category: "category",
  brand: "brand",
  unit: "unit",
  size: "unit",
};

export type ImportPlan = {
  items: ImportItem[];
  errors: { line: number; message: string }[];
};

/**
 * @param resolveCategory maps a category name or slug to its ID (or null).
 */
export function planImport(text: string, resolveCategory: (name: string) => string | null): ImportPlan {
  const rows = parseCsv(text);
  if (rows.length === 0) return { items: [], errors: [{ line: 1, message: "The file is empty" }] };

  const header = rows[0].map((h) => ALIASES[h.trim().toLowerCase()]);
  for (const required of ["sku", "name", "price"] as const) {
    if (!header.includes(required)) {
      return { items: [], errors: [{ line: 1, message: `Missing a "${required}" column` }] };
    }
  }
  if (rows.length - 1 > MAX_IMPORT_ROWS) {
    return { items: [], errors: [{ line: 1, message: `Import up to ${MAX_IMPORT_ROWS} products at a time` }] };
  }

  const items: ImportItem[] = [];
  const errors: ImportPlan["errors"] = [];
  const seenSkus = new Set<string>();

  rows.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const get = (col: (typeof CSV_COLUMNS)[number]) => {
      const idx = header.indexOf(col);
      return idx >= 0 ? (cells[idx] ?? "").trim() : "";
    };
    const sku = get("sku");
    const name = get("name");
    if (!sku) return errors.push({ line, message: "SKU is empty" });
    if (sku.length > 60) return errors.push({ line, message: "SKU is longer than 60 characters" });
    if (seenSkus.has(sku)) return errors.push({ line, message: `SKU ${sku} appears more than once` });
    if (!name) return errors.push({ line, message: "Name is empty" });
    const priceKobo = parseNairaToKobo(get("price"));
    if (priceKobo === null) return errors.push({ line, message: `Price "${get("price")}" isn't a valid amount` });

    let stockQuantity: number | null = null;
    const stock = get("stock");
    if (stock !== "") {
      if (!/^-?\d+$/.test(stock)) return errors.push({ line, message: `Stock "${stock}" isn't a whole number` });
      stockQuantity = Math.max(0, Number(stock));
    }
    const barcode = get("barcode").replace(/\s/g, "");
    if (barcode && !/^\d{6,14}$/.test(barcode)) return errors.push({ line, message: `Barcode "${barcode}" should be 6–14 digits` });

    const categoryName = get("category");
    const categoryId = categoryName ? resolveCategory(categoryName) : null;
    if (categoryName && !categoryId) return errors.push({ line, message: `Unknown category "${categoryName}"` });

    seenSkus.add(sku);
    items.push({
      sku,
      name: name.slice(0, 160),
      priceKobo,
      stockQuantity,
      barcode: barcode || null,
      categoryId,
      brand: get("brand").slice(0, 80) || null,
      unit: get("unit").slice(0, 40) || null,
      description: get("description").slice(0, 2000) || null,
    });
  });
  return { items, errors };
}
