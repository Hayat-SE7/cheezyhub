-- Add deal discount fields to orders table
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "dealDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "appliedDeals" JSONB NOT NULL DEFAULT '[]';
