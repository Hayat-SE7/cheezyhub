-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: fix_fk_names
--
-- Renames two FKs whose names differ from what Prisma expects.
-- Purely cosmetic — the constraints exist and enforce integrity already.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. ledger_entries.shiftId FK — rename to Prisma's expected name
DO $$ BEGIN
  -- Drop whichever old name exists
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ledger_entries_shiftId_fkey') THEN
    ALTER TABLE "ledger_entries" DROP CONSTRAINT "ledger_entries_shiftId_fkey";
  END IF;
  -- Recreate with the name Prisma generates from the schema
  ALTER TABLE "ledger_entries"
    ADD CONSTRAINT "ledger_entries_shiftId_fkey"
    FOREIGN KEY ("shiftId") REFERENCES "shifts"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
END $$;

-- 2. payments.orderId FK — rename from Payment_orderId_fkey to payments_orderId_fkey
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_orderId_fkey') THEN
    ALTER TABLE "payments" DROP CONSTRAINT "Payment_orderId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_orderId_fkey') THEN
    ALTER TABLE "payments"
      ADD CONSTRAINT "payments_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "orders"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
