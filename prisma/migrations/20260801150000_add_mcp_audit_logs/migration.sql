CREATE TABLE "mcp_audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenId" TEXT,
    "clientId" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "resultStatus" TEXT NOT NULL DEFAULT 'running',
    "safeErrorCode" TEXT,
    "resultSummary" TEXT,
    "idempotencyKey" TEXT,
    "requestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "mcp_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mcp_audit_logs_userId_clientId_idempotencyKey_key"
  ON "mcp_audit_logs"("userId", "clientId", "idempotencyKey");
CREATE INDEX "mcp_audit_logs_userId_createdAt_idx" ON "mcp_audit_logs"("userId", "createdAt");
CREATE INDEX "mcp_audit_logs_tokenId_createdAt_idx" ON "mcp_audit_logs"("tokenId", "createdAt");
ALTER TABLE "mcp_audit_logs" ADD CONSTRAINT "mcp_audit_logs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
