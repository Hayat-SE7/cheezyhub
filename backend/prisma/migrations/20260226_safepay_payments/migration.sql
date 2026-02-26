-- ─────────────────────────────────────────────────────
--  Migration: v6.1 — Safepay Payment Integration
--  Run via: npx prisma migrate dev --name safepay_payments
-- ─────────────────────────────────────────────────────

-- 1. Add payment fields to orders table
ALTER TABLE "orders"
  ADD COLUMN "paymentMethod"  TEXT NOT NULL DEFAULT 'cash',
  ADD COLUMN "paymentStatus"  TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN "safepayTracker" TEXT;

-- Unique index for tracker (webhook lookup by tracker token)
CREATE UNIQUE INDEX "orders_safepayTracker_key"
  ON "orders"("safepayTracker")
  WHERE "safepayTracker" IS NOT NULL;

-- 2. Create payments table
CREATE TABLE "payments" (
  "id"             TEXT             NOT NULL,
  "orderId"        TEXT             NOT NULL,
  "method"         TEXT             NOT NULL,
  "amount"         DOUBLE PRECISION NOT NULL,
  "currency"       TEXT             NOT NULL DEFAULT 'PKR',
  "status"         TEXT             NOT NULL DEFAULT 'pending',
  "safepayTracker" TEXT,
  "safepayRef"     TEXT,
  "metadata"       JSONB,
  "createdAt"      TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3)     NOT NULL,

  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- One payment record per order
CREATE UNIQUE INDEX "payments_orderId_key" ON "payments"("orderId");

-- Foreign key
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_orderId_fkey"
  FOREIGN KEY ("orderId")
  REFERENCES "orders"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
