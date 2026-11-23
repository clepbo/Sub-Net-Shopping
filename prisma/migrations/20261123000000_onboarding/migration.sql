-- AlterTable
ALTER TABLE "Supermarket" ADD COLUMN "onboardedAt" TIMESTAMP(3);

-- Stores approved before this change have already been set up.
UPDATE "Supermarket" SET "onboardedAt" = "updatedAt" WHERE "status" IN ('APPROVED', 'SUSPENDED');
