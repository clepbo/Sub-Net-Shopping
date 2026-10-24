-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ASSIGNED', 'PICKED_UP', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EarningStatus" AS ENUM ('PENDING', 'ELIGIBLE', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PAID');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'OUT_FOR_DELIVERY';
ALTER TYPE "OrderStatus" ADD VALUE 'DELIVERED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "deliveryAddress" TEXT,
ADD COLUMN     "deliveryDistanceKm" DOUBLE PRECISION,
ADD COLUMN     "deliveryLandmark" TEXT,
ADD COLUMN     "deliveryLat" DOUBLE PRECISION,
ADD COLUMN     "deliveryLng" DOUBLE PRECISION,
ADD COLUMN     "deliveryPhone" TEXT,
ADD COLUMN     "outForDeliveryAt" TIMESTAMP(3),
ADD COLUMN     "requiredVehicle" "VehicleType";

-- AlterTable
ALTER TABLE "Rider" ADD COLUMN     "lastLat" DOUBLE PRECISION,
ADD COLUMN     "lastLng" DOUBLE PRECISION,
ADD COLUMN     "lastLocationAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CustomerAddress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "landmark" TEXT,
    "phone" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryAssignment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "deliveryFeeKobo" INTEGER NOT NULL,
    "riderCommissionPercent" DOUBLE PRECISION NOT NULL,
    "riderCommissionKobo" INTEGER NOT NULL,
    "riderEarningKobo" INTEGER NOT NULL,
    "earningStatus" "EarningStatus" NOT NULL DEFAULT 'PENDING',
    "payoutId" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pickedUpAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "DeliveryAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiderPayout" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "deliveryCount" INTEGER NOT NULL,
    "feesKobo" INTEGER NOT NULL,
    "commissionKobo" INTEGER NOT NULL,
    "amountKobo" INTEGER NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "transferReference" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiderPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerAddress_userId_idx" ON "CustomerAddress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryAssignment_orderId_key" ON "DeliveryAssignment"("orderId");

-- CreateIndex
CREATE INDEX "DeliveryAssignment_riderId_status_idx" ON "DeliveryAssignment"("riderId", "status");

-- CreateIndex
CREATE INDEX "DeliveryAssignment_earningStatus_idx" ON "DeliveryAssignment"("earningStatus");

-- CreateIndex
CREATE INDEX "RiderPayout_riderId_createdAt_idx" ON "RiderPayout"("riderId", "createdAt");

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAssignment" ADD CONSTRAINT "DeliveryAssignment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAssignment" ADD CONSTRAINT "DeliveryAssignment_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAssignment" ADD CONSTRAINT "DeliveryAssignment_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "RiderPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderPayout" ADD CONSTRAINT "RiderPayout_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
