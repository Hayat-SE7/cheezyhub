-- Migration: Add deals table
-- Run: npx prisma migrate dev --name add-deals

CREATE TYPE "DealType" AS ENUM ('combo', 'discount', 'promotion', 'featured');
CREATE TYPE "DealLocation" AS ENUM ('slider', 'deals_section', 'both');

CREATE TABLE "deals" (
    "id"              TEXT NOT NULL,
    "title"           TEXT NOT NULL,
    "description"     TEXT,
    "imageUrl"        TEXT,
    "dealType"        "DealType" NOT NULL DEFAULT 'featured',
    "discountType"    TEXT NOT NULL DEFAULT 'flat',
    "discountValue"   DOUBLE PRECISION NOT NULL DEFAULT 0,
    "linkedItemIds"   JSONB NOT NULL DEFAULT '[]',
    "validFrom"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo"         TIMESTAMP(3),
    "displayLocation" "DealLocation" NOT NULL DEFAULT 'both',
    "isActive"        BOOLEAN NOT NULL DEFAULT true,
    "sortOrder"       INTEGER NOT NULL DEFAULT 0,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- NOTE: Prisma will generate this automatically via:
--   npx prisma migrate dev --name add-deals
-- This file is for reference only.
