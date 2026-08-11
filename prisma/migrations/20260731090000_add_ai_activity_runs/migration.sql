CREATE TABLE "ai_activity_runs" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "surface" TEXT NOT NULL,
  "phase" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'running',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "currentTool" TEXT,
  "pendingConfirmation" JSONB,
  "resultRef" TEXT,
  "resultSummary" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  CONSTRAINT "ai_activity_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ai_activity_runs_userId_updatedAt_idx" ON "ai_activity_runs"("userId", "updatedAt");
CREATE INDEX "ai_activity_runs_status_expiresAt_idx" ON "ai_activity_runs"("status", "expiresAt");
ALTER TABLE "ai_activity_runs" ADD CONSTRAINT "ai_activity_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ai_activity_events" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "phase" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "detail" TEXT,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sourceCount" INTEGER,
  "toolName" TEXT,
  "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false,
  "recoverable" BOOLEAN NOT NULL DEFAULT false,
  "terminal" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "ai_activity_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ai_activity_events_runId_sequence_key" ON "ai_activity_events"("runId", "sequence");
CREATE INDEX "ai_activity_events_runId_timestamp_idx" ON "ai_activity_events"("runId", "timestamp");
ALTER TABLE "ai_activity_events" ADD CONSTRAINT "ai_activity_events_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ai_activity_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
