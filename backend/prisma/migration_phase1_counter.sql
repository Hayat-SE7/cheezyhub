-- ─────────────────────────────────────────────────────────────
--  CheezyHub Phase 1 — Counter / POS Migration
--  Safe to run on existing database (all IF NOT EXISTS / IF EXISTS)
-- ─────────────────────────────────────────────────────────────

-- 1. Add cashier to UserRole enum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'cashier';

-- 2. Create OrderType enum
DO $$ BEGIN
  CREATE TYPE "OrderType" AS ENUM ('delivery', 'counter', 'dine_in');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 3. Make customerId nullable on orders (for anonymous walk-in counter orders)
ALTER TABLE "orders" ALTER COLUMN "customerId" DROP NOT NULL;

-- 4. Add orderType column to orders
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "orderType" "OrderType" NOT NULL DEFAULT 'delivery';

-- 5. Add cashierId column to orders
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cashierId" TEXT;

-- 6. Add FK constraint for cashierId (only if not already exists)
DO $$ BEGIN
  ALTER TABLE "orders"
    ADD CONSTRAINT "orders_cashierId_fkey"
    FOREIGN KEY ("cashierId") REFERENCES "staff"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 7. Create shifts table
CREATE TABLE IF NOT EXISTS "shifts" (
  "id"           TEXT             NOT NULL,
  "cashierId"    TEXT             NOT NULL,
  "startedAt"    TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt"      TIMESTAMP(3),
  "openingFloat" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "closingCash"  DOUBLE PRECISION,
  "expectedCash" DOUBLE PRECISION,
  "discrepancy"  DOUBLE PRECISION,
  "orderCount"   INTEGER          NOT NULL DEFAULT 0,
  "totalSales"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status"       TEXT             NOT NULL DEFAULT 'open',
  "notes"        TEXT,
  "createdAt"    TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "shifts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shifts_cashierId_fkey"
    FOREIGN KEY ("cashierId") REFERENCES "staff"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 8. Create ledger_entries table
CREATE TABLE IF NOT EXISTS "ledger_entries" (
  "id"          TEXT             NOT NULL,
  "orderId"     TEXT             NOT NULL,
  "cashierId"   TEXT             NOT NULL,
  "shiftId"     TEXT,
  "amount"      DOUBLE PRECISION NOT NULL,
  "method"      TEXT             NOT NULL DEFAULT 'cash',
  "cashAmount"  DOUBLE PRECISION,
  "cardAmount"  DOUBLE PRECISION,
  "collectedAt" TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes"       TEXT,

  CONSTRAINT "ledger_entries_pkey"       PRIMARY KEY ("id"),
  CONSTRAINT "ledger_entries_orderId_key" UNIQUE ("orderId"),
  CONSTRAINT "ledger_entries_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ledger_entries_cashierId_fkey"
    FOREIGN KEY ("cashierId") REFERENCES "staff"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ledger_entries_shiftId_fkey"
    FOREIGN KEY ("shiftId") REFERENCES "shifts"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

-- Done
