-- Add idempotencyKey to orders
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

-- Create offline_sync_logs table
CREATE TABLE IF NOT EXISTS "offline_sync_logs" (
  "id" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "orderId" TEXT,
  "cashierId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "offline_sync_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "offline_sync_logs_idempotencyKey_key" ON "offline_sync_logs"("idempotencyKey");
