CREATE TABLE "cognitive_replan_requests" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "outcomeEventId" TEXT NOT NULL,
  "completedTaskId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastError" TEXT,
  "resultingActionPlanId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "claimedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "cognitive_replan_requests_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cognitive_replan_requests_outcomeEventId_key" ON "cognitive_replan_requests"("outcomeEventId");
CREATE INDEX "cognitive_replan_requests_userId_status_nextAttemptAt_idx" ON "cognitive_replan_requests"("userId", "status", "nextAttemptAt");
CREATE INDEX "cognitive_replan_requests_resultingActionPlanId_idx" ON "cognitive_replan_requests"("resultingActionPlanId");
ALTER TABLE "cognitive_replan_requests" ADD CONSTRAINT "cognitive_replan_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cognitive_replan_requests" ADD CONSTRAINT "cognitive_replan_requests_outcomeEventId_fkey" FOREIGN KEY ("outcomeEventId") REFERENCES "outcome_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
