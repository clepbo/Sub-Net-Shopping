-- AlterEnum
ALTER TYPE "InventorySource" ADD VALUE 'CSV_IMPORT';

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "icon" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "createdBySupermarketId" TEXT,
ADD COLUMN     "unit" TEXT;

-- CreateIndex
CREATE INDEX "Inventory_productId_idx" ON "Inventory"("productId");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId", "sortOrder");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_createdBySupermarketId_fkey" FOREIGN KEY ("createdBySupermarketId") REFERENCES "Supermarket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_supermarketId_fkey" FOREIGN KEY ("supermarketId") REFERENCES "Supermarket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Default supermarket departments. Admins can rename, reorder or add more.
INSERT INTO "Category" ("id", "name", "slug", "icon", "sortOrder") VALUES
  ('cat_groceries',   'Groceries & Staples',      'groceries',          '🌾', 10),
  ('cat_fresh',       'Fresh Produce',            'fresh-produce',      '🥬', 20),
  ('cat_meat',        'Meat, Fish & Poultry',     'meat-fish',          '🍗', 30),
  ('cat_dairy',       'Dairy & Eggs',             'dairy-eggs',         '🥛', 40),
  ('cat_frozen',      'Frozen Foods',             'frozen',             '🧊', 50),
  ('cat_bakery',      'Bakery',                   'bakery',             '🍞', 60),
  ('cat_beverages',   'Beverages',                'beverages',          '🧃', 70),
  ('cat_snacks',      'Snacks & Confectionery',   'snacks',             '🍫', 80),
  ('cat_drinks',      'Wines & Spirits',          'wines-spirits',      '🍷', 90),
  ('cat_baby',        'Baby & Mother',            'baby',               '🍼', 100),
  ('cat_beauty',      'Health & Beauty',          'health-beauty',      '🧴', 110),
  ('cat_household',   'Household & Cleaning',     'household',          '🧽', 120),
  ('cat_kitchen',     'Home & Kitchen',           'home-kitchen',       '🍳', 130),
  ('cat_electronics', 'Electronics & Appliances', 'electronics',        '📺', 140)
ON CONFLICT DO NOTHING;
