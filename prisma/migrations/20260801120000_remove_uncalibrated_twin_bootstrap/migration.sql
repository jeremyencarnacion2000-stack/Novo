-- A Twin without initialization or owned signals has no calibrated confidence.
-- Preserve every measured score; only replace the legacy decorative bootstrap.
ALTER TABLE "cognitive_twin_records"
  ALTER COLUMN "confidenceScore" SET DEFAULT 0;

UPDATE "cognitive_twin_records"
SET "confidenceScore" = 0
WHERE "confidenceScore" = 42
  AND "isInitialized" = false
  AND "totalSignals" = 0;
