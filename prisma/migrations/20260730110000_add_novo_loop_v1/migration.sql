-- Additive persistence for the Novo Loop v1. Existing goals/tasks remain intact.
ALTER TABLE "goals" ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE "goals" ADD COLUMN "successCondition" TEXT;
ALTER TABLE "goals" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "goals" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "cognitive_profiles" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "preferredWorkPeriods" JSONB NOT NULL DEFAULT '[]',
  "typicalSessionMinutes" INTEGER,
  "planningPreference" TEXT,
  "interruptionTolerance" TEXT,
  "notificationPreference" TEXT,
  "constraints" JSONB NOT NULL DEFAULT '[]',
  "proactiveEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cognitive_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cognitive_profiles_userId_key" ON "cognitive_profiles"("userId");
ALTER TABLE "cognitive_profiles" ADD CONSTRAINT "cognitive_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "cognitive_state_snapshots" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "energy" INTEGER, "focus" INTEGER,
  "availableMinutes" INTEGER, "workload" INTEGER, "currentContext" TEXT, "source" TEXT NOT NULL DEFAULT 'checkin',
  "completeness" DOUBLE PRECISION NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cognitive_state_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "cognitive_state_snapshots_userId_createdAt_idx" ON "cognitive_state_snapshots"("userId", "createdAt");
ALTER TABLE "cognitive_state_snapshots" ADD CONSTRAINT "cognitive_state_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "action_plans" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "goalId" TEXT, "stateSnapshotId" TEXT,
  "planningDate" TIMESTAMP(3) NOT NULL, "timezone" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'active',
  "reasoningSummary" TEXT NOT NULL, "inputs" JSONB NOT NULL, "algorithmVersion" TEXT NOT NULL,
  "generatedBy" TEXT NOT NULL DEFAULT 'deterministic', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "action_plans_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "action_plans_userId_planningDate_idx" ON "action_plans"("userId", "planningDate");
CREATE INDEX "action_plans_goalId_idx" ON "action_plans"("goalId");
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_stateSnapshotId_fkey" FOREIGN KEY ("stateSnapshotId") REFERENCES "cognitive_state_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "recommended_actions" (
  "id" TEXT NOT NULL, "planId" TEXT NOT NULL, "userId" TEXT NOT NULL, "taskId" TEXT,
  "title" TEXT NOT NULL, "nextStep" TEXT NOT NULL, "priority" INTEGER NOT NULL, "estimatedMinutes" INTEGER,
  "confidence" DOUBLE PRECISION NOT NULL, "explanation" TEXT NOT NULL, "facts" JSONB NOT NULL,
  "inferences" JSONB NOT NULL, "status" TEXT NOT NULL DEFAULT 'proposed', "responseNote" TEXT,
  "responseAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "recommended_actions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "recommended_actions_userId_status_createdAt_idx" ON "recommended_actions"("userId", "status", "createdAt");
CREATE INDEX "recommended_actions_planId_priority_idx" ON "recommended_actions"("planId", "priority");
ALTER TABLE "recommended_actions" ADD CONSTRAINT "recommended_actions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "action_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recommended_actions" ADD CONSTRAINT "recommended_actions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "outcome_events" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "planId" TEXT, "recommendedActionId" TEXT,
  "type" TEXT NOT NULL, "metadata" JSONB, "idempotencyKey" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "outcome_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "outcome_events_idempotencyKey_key" ON "outcome_events"("idempotencyKey");
CREATE INDEX "outcome_events_userId_type_createdAt_idx" ON "outcome_events"("userId", "type", "createdAt");
CREATE INDEX "outcome_events_recommendedActionId_createdAt_idx" ON "outcome_events"("recommendedActionId", "createdAt");
ALTER TABLE "outcome_events" ADD CONSTRAINT "outcome_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outcome_events" ADD CONSTRAINT "outcome_events_planId_fkey" FOREIGN KEY ("planId") REFERENCES "action_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "outcome_events" ADD CONSTRAINT "outcome_events_recommendedActionId_fkey" FOREIGN KEY ("recommendedActionId") REFERENCES "recommended_actions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "integration_permissions" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "provider" TEXT NOT NULL,
  "grantedScopes" JSONB NOT NULL DEFAULT '[]', "allowedReads" JSONB NOT NULL DEFAULT '[]',
  "allowedWrites" JSONB NOT NULL DEFAULT '[]', "revokedAt" TIMESTAMP(3), "lastSuccessfulSync" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "integration_permissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "integration_permissions_userId_provider_key" ON "integration_permissions"("userId", "provider");
CREATE INDEX "integration_permissions_userId_revokedAt_idx" ON "integration_permissions"("userId", "revokedAt");
ALTER TABLE "integration_permissions" ADD CONSTRAINT "integration_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
