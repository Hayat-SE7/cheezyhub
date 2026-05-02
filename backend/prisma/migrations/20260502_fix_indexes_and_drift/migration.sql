-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: fix_indexes_and_drift
--
-- Resolves remaining drift between the live DB and local schema:
--  1. Drop stale enums (DriverStatus, RequestStatus, VerificationStatus) —
--     must DROP DEFAULT first so the cast expression dependency is removed
--  2. Add missing FK on ledger_entries.shiftId
--  3. Fix offline_sync_logs constraint name casing (DROP CONSTRAINT, not DROP INDEX)
--  4. Add missing unique index on orders(idempotencyKey, customerId)
--  5. Add missing FK + fix index name on payments.orderId
--  6. Add missing index on refresh_tokens(expiresAt)
--  7. Add missing compound index on staff(role, isActive, driverStatus, verificationStatus)
--  8. Add missing unique index on system_settings(singleton)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Convert enum columns to TEXT then drop the stale enum types.
--    DROP DEFAULT first to sever the cast expression dependency.

ALTER TABLE "staff" ALTER COLUMN "driverStatus" DROP DEFAULT;
ALTER TABLE "staff" ALTER COLUMN "driverStatus" TYPE TEXT USING "driverStatus"::TEXT;
ALTER TABLE "staff" ALTER COLUMN "driverStatus" SET DEFAULT 'OFFLINE';

ALTER TABLE "staff" ALTER COLUMN "verificationStatus" DROP DEFAULT;
ALTER TABLE "staff" ALTER COLUMN "verificationStatus" TYPE TEXT USING "verificationStatus"::TEXT;
ALTER TABLE "staff" ALTER COLUMN "verificationStatus" SET DEFAULT 'PENDING';

-- holiday_requests.status: only alter if still an enum type
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'holiday_requests'
      AND column_name = 'status'
      AND data_type = 'USER-DEFINED'
  ) THEN
    ALTER TABLE "holiday_requests" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "holiday_requests" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
    ALTER TABLE "holiday_requests" ALTER COLUMN "status" SET DEFAULT 'PENDING';
  END IF;
END $$;

DROP TYPE IF EXISTS "DriverStatus";
DROP TYPE IF EXISTS "RequestStatus";
DROP TYPE IF EXISTS "VerificationStatus";

-- 2. FK: ledger_entries.shiftId → shifts.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ledger_entries_shiftId_fkey'
  ) THEN
    ALTER TABLE "ledger_entries"
      ADD CONSTRAINT "ledger_entries_shiftId_fkey"
      FOREIGN KEY ("shiftId") REFERENCES "shifts"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 3. Fix offline_sync_logs constraint name casing.
--    The index is constraint-backed so use DROP CONSTRAINT, not DROP INDEX.
ALTER TABLE "offline_sync_logs"
  DROP CONSTRAINT IF EXISTS "offline_sync_logs_idempotencykey_key";
CREATE UNIQUE INDEX IF NOT EXISTS "offline_sync_logs_idempotencyKey_key"
  ON "offline_sync_logs"("idempotencyKey");

-- 4. Unique index on orders(idempotencyKey, customerId)
CREATE UNIQUE INDEX IF NOT EXISTS "orders_idempotencyKey_customerId_key"
  ON "orders"("idempotencyKey", "customerId");

-- 5a. FK: payments.orderId → orders.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Payment_orderId_fkey'
  ) THEN
    ALTER TABLE "payments"
      ADD CONSTRAINT "Payment_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "orders"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- 5b. Fix payments unique index name casing (also constraint-backed)
ALTER TABLE "payments"
  DROP CONSTRAINT IF EXISTS "payments_orderid_key";
CREATE UNIQUE INDEX IF NOT EXISTS "payments_orderId_key"
  ON "payments"("orderId");

-- 6. Index on refresh_tokens(expiresAt)
CREATE INDEX IF NOT EXISTS "refresh_tokens_expiresAt_idx"
  ON "refresh_tokens"("expiresAt");

-- 7. Compound index on staff
CREATE INDEX IF NOT EXISTS "staff_role_isActive_driverStatus_verificationStatus_idx"
  ON "staff"("role", "isActive", "driverStatus", "verificationStatus");

-- 8. Unique index on system_settings(singleton)
CREATE UNIQUE INDEX IF NOT EXISTS "system_settings_singleton_key"
  ON "system_settings"("singleton");
