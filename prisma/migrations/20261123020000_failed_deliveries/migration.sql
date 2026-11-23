-- CreateEnum
CREATE TYPE "DeliveryFailureReason" AS ENUM ('CUSTOMER_UNREACHABLE', 'WRONG_ADDRESS', 'CUSTOMER_REFUSED', 'RIDER_ISSUE', 'OTHER');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'DELIVERY_FAILED' AFTER 'OUT_FOR_DELIVERY';

-- AlterEnum
ALTER TYPE "AssignmentStatus" ADD VALUE 'FAILED' AFTER 'DELIVERED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "deliveryFailedAt" TIMESTAMP(3),
ADD COLUMN "deliveryFailReason" "DeliveryFailureReason",
ADD COLUMN "deliveryFailNote" TEXT;
