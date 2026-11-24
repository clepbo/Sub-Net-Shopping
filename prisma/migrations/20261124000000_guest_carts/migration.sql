-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "guestId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "CartItem_updatedAt_idx" ON "CartItem"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_guestId_inventoryId_key" ON "CartItem"("guestId", "inventoryId");


-- Every cart line belongs to an account or a guest.
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_owner_check" CHECK ("userId" IS NOT NULL OR "guestId" IS NOT NULL);
