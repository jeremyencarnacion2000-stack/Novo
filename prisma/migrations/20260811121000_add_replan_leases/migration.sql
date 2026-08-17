ALTER TABLE "cognitive_replan_requests" ADD COLUMN "leaseExpiresAt" TIMESTAMP(3);
ALTER TABLE "cognitive_replan_requests" ADD COLUMN "claimToken" TEXT;
CREATE INDEX "cognitive_replan_requests_status_leaseExpiresAt_nextAttemptAt_idx" ON "cognitive_replan_requests"("status", "leaseExpiresAt", "nextAttemptAt");
