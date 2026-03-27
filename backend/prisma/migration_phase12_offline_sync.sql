-- ──────────────────────────────────────────────────────────────
--  CheezyHub — Phase 12 Migration
--  Run: npx prisma migrate dev --name phase12_offline_sync
-- ──────────────────────────────────────────────────────────────

-- 1. Add offlineSync flag to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS "offlineSync" BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Create OfflineSyncLog for idempotency
--    Prevents double-processing if a sync POST is retried due to
--    a network error on the response side.
CREATE TABLE IF NOT EXISTS offline_sync_log (
  id          TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "localId"   TEXT        NOT NULL UNIQUE,
  "cashierId" TEXT        NOT NULL,
  type        TEXT        NOT NULL,
  "serverId"  TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup on localId (idempotency check on every sync item)
CREATE UNIQUE INDEX IF NOT EXISTS offline_sync_log_local_id_idx
  ON offline_sync_log ("localId");

-- 3. Comments for documentation
COMMENT ON COLUMN orders."offlineSync" IS
  'true = order arrived via the offline queue sync endpoint (POST /counter/sync)';

COMMENT ON TABLE offline_sync_log IS
  'Idempotency log for offline sync. Prevents double-processing if the client retries a POST /counter/sync after a network error on the response.';
