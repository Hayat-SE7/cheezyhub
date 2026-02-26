-- ─────────────────────────────────────────────────────
--  Migration: v6.1 — OTP Verification + WhatsApp logs
--  Run via: npx prisma migrate dev --name otp_and_whatsapp
--
--  Changes:
--    users              + 5 OTP fields
--    notification_logs  + errorMsg, retryCount
-- ─────────────────────────────────────────────────────

-- 1. OTP fields on users
ALTER TABLE "users"
  ADD COLUMN "isVerified"    BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN "otpHash"       TEXT,
  ADD COLUMN "otpExpiresAt"  TIMESTAMP(3),
  ADD COLUMN "otpAttempts"   INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN "otpLastSentAt" TIMESTAMP(3);

-- 2. WhatsApp log improvements
ALTER TABLE "notification_logs"
  ADD COLUMN "errorMsg"    TEXT,
  ADD COLUMN "retryCount"  INTEGER NOT NULL DEFAULT 0;
