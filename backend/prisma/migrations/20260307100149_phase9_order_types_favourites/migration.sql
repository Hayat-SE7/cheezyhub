/*
  Warnings:

  - You are about to drop the column `activeOrderCount` on the `staff` table. All the data in the column will be lost.
  - You are about to drop the column `cnic` on the `staff` table. All the data in the column will be lost.
  - You are about to drop the column `cnicBackUrl` on the `staff` table. All the data in the column will be lost.
  - You are about to drop the column `cnicFrontUrl` on the `staff` table. All the data in the column will be lost.
  - You are about to drop the column `codPending` on the `staff` table. All the data in the column will be lost.
  - You are about to drop the column `driverStatus` on the `staff` table. All the data in the column will be lost.
  - You are about to drop the column `emergencyContact` on the `staff` table. All the data in the column will be lost.
  - You are about to drop the column `fullName` on the `staff` table. All the data in the column will be lost.
  - You are about to drop the column `licensePhotoUrl` on the `staff` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `staff` table. All the data in the column will be lost.
  - You are about to drop the column `profilePhotoUrl` on the `staff` table. All the data in the column will be lost.
  - You are about to drop the column `todayDeliveries` on the `staff` table. All the data in the column will be lost.
  - You are about to drop the column `totalDeliveries` on the `staff` table. All the data in the column will be lost.
  - You are about to drop the column `vehiclePlate` on the `staff` table. All the data in the column will be lost.
  - You are about to drop the column `vehicleType` on the `staff` table. All the data in the column will be lost.
  - You are about to drop the column `verificationNote` on the `staff` table. All the data in the column will be lost.
  - You are about to drop the column `verificationStatus` on the `staff` table. All the data in the column will be lost.
  - You are about to drop the column `verifiedAt` on the `staff` table. All the data in the column will be lost.
  - You are about to drop the column `verifiedBy` on the `staff` table. All the data in the column will be lost.
  - You are about to drop the `driver_settlements` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `holiday_requests` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
ALTER TYPE "OrderType" ADD VALUE 'pickup';

-- DropForeignKey
ALTER TABLE "driver_settlements" DROP CONSTRAINT "driver_settlements_driverId_fkey";

-- DropForeignKey
ALTER TABLE "holiday_requests" DROP CONSTRAINT "holiday_requests_driverId_fkey";

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "tableNumber" TEXT;

-- AlterTable
ALTER TABLE "staff" DROP COLUMN "activeOrderCount",
DROP COLUMN "cnic",
DROP COLUMN "cnicBackUrl",
DROP COLUMN "cnicFrontUrl",
DROP COLUMN "codPending",
DROP COLUMN "driverStatus",
DROP COLUMN "emergencyContact",
DROP COLUMN "fullName",
DROP COLUMN "licensePhotoUrl",
DROP COLUMN "phone",
DROP COLUMN "profilePhotoUrl",
DROP COLUMN "todayDeliveries",
DROP COLUMN "totalDeliveries",
DROP COLUMN "vehiclePlate",
DROP COLUMN "vehicleType",
DROP COLUMN "verificationNote",
DROP COLUMN "verificationStatus",
DROP COLUMN "verifiedAt",
DROP COLUMN "verifiedBy";

-- DropTable
DROP TABLE "driver_settlements";

-- DropTable
DROP TABLE "holiday_requests";

-- DropEnum
DROP TYPE "DriverStatus";

-- DropEnum
DROP TYPE "RequestStatus";

-- DropEnum
DROP TYPE "VerificationStatus";

-- CreateTable
CREATE TABLE "favourites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favourites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "favourites_userId_menuItemId_key" ON "favourites"("userId", "menuItemId");

-- AddForeignKey
ALTER TABLE "favourites" ADD CONSTRAINT "favourites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favourites" ADD CONSTRAINT "favourites_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
