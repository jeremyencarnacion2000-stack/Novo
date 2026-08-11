ALTER TABLE "recommended_actions" ADD COLUMN "statusAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "recommended_actions" ADD COLUMN "startedAt" TIMESTAMP(3);
ALTER TABLE "recommended_actions" ADD COLUMN "completedAt" TIMESTAMP(3);
ALTER TABLE "recommended_actions" ADD COLUMN "terminalReason" TEXT;
ALTER TABLE "recommended_actions" ADD COLUMN "lastActor" TEXT NOT NULL DEFAULT 'user';

CREATE TABLE "external_action_executions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "recommendedActionId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "externalResourceId" TEXT,
  "safeErrorCode" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "external_action_executions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "external_action_executions_userId_provider_operation_idempotencyKey_key" ON "external_action_executions"("userId", "provider", "operation", "idempotencyKey");
CREATE INDEX "external_action_executions_recommendedActionId_status_idx" ON "external_action_executions"("recommendedActionId", "status");
CREATE INDEX "external_action_executions_status_updatedAt_idx" ON "external_action_executions"("status", "updatedAt");
ALTER TABLE "external_action_executions" ADD CONSTRAINT "external_action_executions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "external_action_executions" ADD CONSTRAINT "external_action_executions_recommendedActionId_fkey" FOREIGN KEY ("recommendedActionId") REFERENCES "recommended_actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
