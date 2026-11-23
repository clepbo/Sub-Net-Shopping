-- AlterTable
ALTER TABLE "Supermarket" ADD COLUMN     "posApiKeyHash" TEXT,
ADD COLUMN     "posApiKeyHint" TEXT,
ADD COLUMN     "posFeedSyncedAt" TIMESTAMP(3),
ADD COLUMN     "posFeedUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Supermarket_posApiKeyHash_key" ON "Supermarket"("posApiKeyHash");

