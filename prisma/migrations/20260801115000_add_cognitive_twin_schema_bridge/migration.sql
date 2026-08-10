-- Bridge Cognitive Twin tables that existed in deployed schemas before they
-- appeared in the checked-in migration chain. Every create is idempotent so
-- existing databases retain their objects and clean databases can replay.

CREATE TABLE IF NOT EXISTS "cognitive_twin_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trustLevel" TEXT NOT NULL DEFAULT 'initial',
    "isInitialized" BOOLEAN NOT NULL DEFAULT false,
    "onboardingCompletedAt" TIMESTAMP(3),
    "longTermGoal" TEXT NOT NULL DEFAULT '',
    "identity" JSONB NOT NULL DEFAULT '{}',
    "energyCurve" JSONB NOT NULL DEFAULT '{}',
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "bottlenecks" JSONB NOT NULL DEFAULT '{}',
    "workspaceLayout" JSONB NOT NULL DEFAULT '{}',
    "totalSignals" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cognitive_twin_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "behavioral_signals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "twinId" TEXT NOT NULL,
    "signal" TEXT NOT NULL,
    "hour" INTEGER,
    "duration" INTEGER,
    "quality" INTEGER,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "behavioral_signals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "twin_evolution_logs" (
    "id" TEXT NOT NULL,
    "twinId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "prevValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "twin_evolution_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "twin_snapshots" (
    "id" TEXT NOT NULL,
    "twinId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "trustLevel" TEXT NOT NULL,
    "cognitiveLoad" DOUBLE PRECISION NOT NULL,
    "burnoutIndex" DOUBLE PRECISION NOT NULL,
    "chronotype" TEXT NOT NULL,
    "mainFrictionPoint" TEXT NOT NULL,
    "peakFocusStart" TEXT NOT NULL,
    "peakFocusEnd" TEXT NOT NULL,
    "totalSignals" INTEGER NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "twin_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cognitive_twin_records_userId_key"
    ON "cognitive_twin_records"("userId");

CREATE INDEX IF NOT EXISTS "behavioral_signals_userId_signal_idx"
    ON "behavioral_signals"("userId", "signal");
CREATE INDEX IF NOT EXISTS "behavioral_signals_userId_occurredAt_idx"
    ON "behavioral_signals"("userId", "occurredAt");
CREATE INDEX IF NOT EXISTS "behavioral_signals_twinId_occurredAt_idx"
    ON "behavioral_signals"("twinId", "occurredAt");

CREATE INDEX IF NOT EXISTS "twin_evolution_logs_userId_createdAt_idx"
    ON "twin_evolution_logs"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "twin_evolution_logs_twinId_createdAt_idx"
    ON "twin_evolution_logs"("twinId", "createdAt");
CREATE INDEX IF NOT EXISTS "twin_evolution_logs_twinId_changeType_createdAt_idx"
    ON "twin_evolution_logs"("twinId", "changeType", "createdAt");

CREATE INDEX IF NOT EXISTS "twin_snapshots_userId_snapshotDate_idx"
    ON "twin_snapshots"("userId", "snapshotDate");
CREATE UNIQUE INDEX IF NOT EXISTS "twin_snapshots_twinId_snapshotDate_key"
    ON "twin_snapshots"("twinId", "snapshotDate");

DO $$
BEGIN
    ALTER TABLE "cognitive_twin_records"
        ADD CONSTRAINT "cognitive_twin_records_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "behavioral_signals"
        ADD CONSTRAINT "behavioral_signals_twinId_fkey"
        FOREIGN KEY ("twinId") REFERENCES "cognitive_twin_records"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "twin_evolution_logs"
        ADD CONSTRAINT "twin_evolution_logs_twinId_fkey"
        FOREIGN KEY ("twinId") REFERENCES "cognitive_twin_records"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "twin_snapshots"
        ADD CONSTRAINT "twin_snapshots_twinId_fkey"
        FOREIGN KEY ("twinId") REFERENCES "cognitive_twin_records"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
