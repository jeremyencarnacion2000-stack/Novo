ALTER TABLE "cognitive_twin_records"
  ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3);

-- Historical Twins were already considered onboarded through isInitialized.
-- Preserve that state and use the record's last known update as the closest
-- available completion timestamp instead of forcing those users through Day 1.
UPDATE "cognitive_twin_records"
SET "onboardingCompletedAt" = "updatedAt"
WHERE "isInitialized" = TRUE
  AND "onboardingCompletedAt" IS NULL;
