-- CreateEnum
CREATE TYPE "WalletEntryType" AS ENUM ('CASH_COLLECTED', 'REMITTANCE', 'ADJUSTMENT');

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'CASH_ON_DELIVERY';

-- AlterEnum
ALTER TYPE "PaymentProvider" ADD VALUE 'MONNIFY';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SettlementStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "SettlementStatus" ADD VALUE 'FAILED';

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "markupPercent" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Inventory" ADD COLUMN     "shelfPriceKobo" INTEGER;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "shelfPriceKobo" INTEGER;

-- AlterTable
ALTER TABLE "Rider" ADD COLUMN     "bankAccountName" TEXT,
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankCode" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "cashBlockedAt" TIMESTAMP(3),
ADD COLUMN     "virtualAccountBank" TEXT,
ADD COLUMN     "virtualAccountName" TEXT,
ADD COLUMN     "virtualAccountNumber" TEXT,
ADD COLUMN     "virtualAccountRef" TEXT,
ADD COLUMN     "walletBalanceKobo" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Settlement" ADD COLUMN     "payoutAttemptedAt" TIMESTAMP(3),
ADD COLUMN     "payoutError" TEXT,
ADD COLUMN     "payoutProvider" TEXT,
ADD COLUMN     "payoutReference" TEXT;

-- AlterTable
ALTER TABLE "Supermarket" ADD COLUMN     "bankAccountName" TEXT,
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankCode" TEXT,
ADD COLUMN     "bankName" TEXT;

-- CreateTable
CREATE TABLE "RiderWalletEntry" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "type" "WalletEntryType" NOT NULL,
    "amountKobo" INTEGER NOT NULL,
    "balanceKobo" INTEGER NOT NULL,
    "orderId" TEXT,
    "reference" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiderWalletEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RiderWalletEntry_orderId_key" ON "RiderWalletEntry"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "RiderWalletEntry_reference_key" ON "RiderWalletEntry"("reference");

-- CreateIndex
CREATE INDEX "RiderWalletEntry_riderId_createdAt_idx" ON "RiderWalletEntry"("riderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Rider_virtualAccountRef_key" ON "Rider"("virtualAccountRef");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_payoutReference_key" ON "Settlement"("payoutReference");

-- AddForeignKey
ALTER TABLE "RiderWalletEntry" ADD CONSTRAINT "RiderWalletEntry_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Markup pricing: staples priced closer to shelf value, high-margin lines a little higher
-- (the platform default, 14%, lives in PlatformSetting and applies to everything else).
UPDATE "Category" SET "markupPercent" = 12 WHERE "id" IN ('cat_groceries', 'cat_dairy', 'cat_bakery', 'cat_fresh');
UPDATE "Category" SET "markupPercent" = 16 WHERE "id" IN ('cat_snacks', 'cat_beauty', 'cat_household');

-- Existing prices become the stores' shelf prices; customer prices are marked up
-- from them and rounded up like src/lib/pricing.ts: to ₦10 under ₦500, ₦50 under
-- ₦5,000, otherwise ₦100, and never below the shelf price.
UPDATE "Inventory" i SET
  "shelfPriceKobo" = i."priceKobo",
  "priceKobo" = GREATEST(i."priceKobo", (
    SELECT CEIL(m.raw / m.step) * m.step
    FROM (SELECT x.raw, CASE WHEN x.raw < 50000 THEN 1000 WHEN x.raw < 500000 THEN 5000 ELSE 10000 END AS step
          FROM (SELECT i."priceKobo" * (1 + COALESCE(c."markupPercent", 14) / 100.0) AS raw) x) m
  ))::int
FROM "Product" p LEFT JOIN "Category" c ON c."id" = p."categoryId"
WHERE p."id" = i."productId";
