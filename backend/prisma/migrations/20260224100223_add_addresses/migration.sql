-- ─────────────────────────────────────────────────────
--  Migration: addresses_and_user_location
--
--  Adds the Address model and User live-location fields
--  that were in the schema but never migrated to the DB.
--
--  Run AFTER: 20260226_otp_and_whatsapp
--             20260226_add_modifier_group_item_fk
-- ─────────────────────────────────────────────────────

-- 1. User live-location + default address fields
--    All nullable so they're safe to add to existing rows.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "liveLat"            DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "liveLng"            DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "liveAddress"        TEXT,
  ADD COLUMN IF NOT EXISTS "isLocationVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "defaultAddressId"   TEXT;

-- 2. AddressType enum
DO $$ BEGIN
  CREATE TYPE "AddressType" AS ENUM ('home', 'work', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Addresses table
CREATE TABLE IF NOT EXISTS "addresses" (
  "id"          TEXT             NOT NULL,
  "userId"      TEXT             NOT NULL,
  "label"       TEXT             NOT NULL DEFAULT 'Home',
  "type"        "AddressType"    NOT NULL DEFAULT 'home',
  "addressText" TEXT             NOT NULL,
  "houseNo"     TEXT,
  "street"      TEXT,
  "area"        TEXT,
  "city"        TEXT,
  "notes"       TEXT,
  "latitude"    DOUBLE PRECISION,
  "longitude"   DOUBLE PRECISION,
  "isGps"       BOOLEAN          NOT NULL DEFAULT false,
  "isDefault"   BOOLEAN          NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- 4. Foreign key: addresses.userId → users.id (CASCADE delete)
ALTER TABLE "addresses"
  ADD CONSTRAINT "addresses_userId_fkey"
  FOREIGN KEY ("userId")
  REFERENCES "users"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;