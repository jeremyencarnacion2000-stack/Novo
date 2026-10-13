-- CreateTable
CREATE TABLE "project_delegations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memoryId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "capabilities" TEXT[],
    "triggers" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "dailyLimit" INTEGER NOT NULL DEFAULT 3,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "verification" JSONB NOT NULL,
    "timeoutSeconds" INTEGER NOT NULL DEFAULT 600,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_delegations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_work" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memoryId" TEXT NOT NULL,
    "projectKey" TEXT NOT NULL,
    "delegationId" TEXT NOT NULL,
    "ruleVersion" INTEGER NOT NULL,
    "deviceId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "trigger" JSONB,
    "scope" JSONB NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'waiting_device',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "leaseTokenHash" TEXT,
    "leaseVersion" INTEGER NOT NULL DEFAULT 0,
    "leaseExpiresAt" TIMESTAMP(3),
    "executionId" TEXT,
    "baseCommit" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "decision" JSONB,
    "result" JSONB,
    "reasonCode" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_work_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_work_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_work_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_delegations_memoryId_key" ON "project_delegations"("memoryId");

-- CreateIndex
CREATE INDEX "project_delegations_userId_enabled_idx" ON "project_delegations"("userId", "enabled");

-- CreateIndex
CREATE INDEX "project_work_userId_projectKey_phase_idx" ON "project_work"("userId", "projectKey", "phase");

-- CreateIndex
CREATE INDEX "project_work_userId_deviceId_phase_createdAt_idx" ON "project_work"("userId", "deviceId", "phase", "createdAt");

-- CreateIndex
CREATE INDEX "project_work_userId_mode_startedAt_idx" ON "project_work"("userId", "mode", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "project_work_userId_requestKey_key" ON "project_work"("userId", "requestKey");

-- CreateIndex
CREATE INDEX "project_work_events_userId_createdAt_idx" ON "project_work_events"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "project_work_events_jobId_sequence_key" ON "project_work_events"("jobId", "sequence");

-- AddForeignKey
ALTER TABLE "project_delegations" ADD CONSTRAINT "project_delegations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_delegations" ADD CONSTRAINT "project_delegations_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "project_assistant_memories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_work" ADD CONSTRAINT "project_work_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_work" ADD CONSTRAINT "project_work_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "project_assistant_memories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_work" ADD CONSTRAINT "project_work_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "project_delegations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_work_events" ADD CONSTRAINT "project_work_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_work_events" ADD CONSTRAINT "project_work_events_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "project_work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

