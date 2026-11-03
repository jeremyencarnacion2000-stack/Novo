CREATE TABLE "assistant_action_requests" (
  "id" TEXT NOT NULL,
  "requestId" UUID NOT NULL,
  "userId" TEXT NOT NULL,
  "deviceId" UUID NOT NULL,
  "clientId" TEXT NOT NULL,
  "grantId" TEXT NOT NULL,
  "operation" JSONB NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'proposed',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "approvedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "result" JSONB,
  "safeErrorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assistant_action_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assistant_action_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "assistant_action_requests_userId_deviceId_fkey" FOREIGN KEY ("userId", "deviceId") REFERENCES "companion_devices"("userId", "deviceId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "assistant_action_requests_requestId_key" ON "assistant_action_requests"("requestId");
CREATE UNIQUE INDEX "assistant_action_requests_userId_deviceId_clientId_requestId_key" ON "assistant_action_requests"("userId", "deviceId", "clientId", "requestId");
CREATE INDEX "assistant_action_requests_userId_deviceId_status_expiresAt_idx" ON "assistant_action_requests"("userId", "deviceId", "status", "expiresAt");
CREATE INDEX "assistant_action_requests_expiresAt_idx" ON "assistant_action_requests"("expiresAt");
