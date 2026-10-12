CREATE TABLE "companion_work_contexts" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "projectLabel" TEXT,
  "focusSummary" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'web',
  "sourceDeviceId" UUID,
  "status" TEXT NOT NULL DEFAULT 'active',
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "companion_work_contexts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "companion_work_contexts_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "companion_work_contexts_userId_key" ON "companion_work_contexts"("userId");
CREATE INDEX "companion_work_contexts_expiresAt_idx" ON "companion_work_contexts"("expiresAt");
