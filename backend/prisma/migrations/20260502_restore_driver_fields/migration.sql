-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: restore_driver_fields
--
-- Phase 9 dropped all driver-specific staff columns and the driver_settlements /
-- holiday_requests tables. The schema re-introduced them (with enums replaced
-- by plain TEXT). This migration brings the DB back in sync with the schema.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Re-add driver fields to staff (previously dropped in phase9)
--    driverStatus / verificationStatus are now TEXT, not enums.
ALTER TABLE "staff"
  ADD COLUMN IF NOT EXISTS "fullName"           TEXT,
  ADD COLUMN IF NOT EXISTS "phone"              TEXT,
  ADD COLUMN IF NOT EXISTS "lastLoginAt"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "vehicleType"        TEXT,
  ADD COLUMN IF NOT EXISTS "vehiclePlate"       TEXT,
  ADD COLUMN IF NOT EXISTS "emergencyContact"   TEXT,
  ADD COLUMN IF NOT EXISTS "cnic"               TEXT,
  ADD COLUMN IF NOT EXISTS "cnicFrontUrl"       TEXT,
  ADD COLUMN IF NOT EXISTS "cnicBackUrl"        TEXT,
  ADD COLUMN IF NOT EXISTS "licensePhotoUrl"    TEXT,
  ADD COLUMN IF NOT EXISTS "profilePhotoUrl"    TEXT,
  ADD COLUMN IF NOT EXISTS "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "verificationNote"   TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedAt"         TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "verifiedBy"         TEXT,
  ADD COLUMN IF NOT EXISTS "driverStatus"       TEXT NOT NULL DEFAULT 'OFFLINE',
  ADD COLUMN IF NOT EXISTS "liveLat"            DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "liveLng"            DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "lastLocationAt"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "codPending"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalDeliveries"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "todayDeliveries"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "activeOrderCount"   INTEGER NOT NULL DEFAULT 0;

-- 2. Add missing columns to orders
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "offlineSync"       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "offlineCreatedAt"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "shiftId"           TEXT;

-- 3. FK: orders.shiftId → shifts.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_shiftId_fkey'
  ) THEN
    ALTER TABLE "orders"
      ADD CONSTRAINT "orders_shiftId_fkey"
      FOREIGN KEY ("shiftId") REFERENCES "shifts"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 4. Recreate driver_settlements table (dropped in phase9)
CREATE TABLE IF NOT EXISTS "driver_settlements" (
  "id"              TEXT             NOT NULL,
  "driverId"        TEXT             NOT NULL,
  "collectedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "submittedAmount" DOUBLE PRECISION NOT NULL,
  "remainingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes"           TEXT,
  "settledBy"       TEXT             NOT NULL,
  "createdAt"       TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "driver_settlements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "driver_settlements_driverId_idx"
  ON "driver_settlements"("driverId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'driver_settlements_driverId_fkey'
  ) THEN
    ALTER TABLE "driver_settlements"
      ADD CONSTRAINT "driver_settlements_driverId_fkey"
      FOREIGN KEY ("driverId") REFERENCES "staff"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- 5. Recreate holiday_requests table (dropped in phase9)
--    status is now TEXT instead of enum RequestStatus
CREATE TABLE IF NOT EXISTS "holiday_requests" (
  "id"         TEXT         NOT NULL,
  "driverId"   TEXT         NOT NULL,
  "fromDate"   TIMESTAMP(3) NOT NULL,
  "toDate"     TIMESTAMP(3) NOT NULL,
  "reason"     TEXT         NOT NULL,
  "status"     TEXT         NOT NULL DEFAULT 'PENDING',
  "reviewedBy" TEXT,
  "reviewNote" TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "holiday_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "holiday_requests_driverId_idx"
  ON "holiday_requests"("driverId");

CREATE INDEX IF NOT EXISTS "holiday_requests_status_idx"
  ON "holiday_requests"("status");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'holiday_requests_driverId_fkey'
  ) THEN
    ALTER TABLE "holiday_requests"
      ADD CONSTRAINT "holiday_requests_driverId_fkey"
      FOREIGN KEY ("driverId") REFERENCES "staff"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
