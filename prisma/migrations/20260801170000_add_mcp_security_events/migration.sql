CREATE TABLE "mcp_security_events" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "clientId" TEXT,
    "reason" TEXT,
    "requestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mcp_security_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mcp_security_events_requestId_key" ON "mcp_security_events"("requestId");
CREATE INDEX "mcp_security_events_createdAt_idx" ON "mcp_security_events"("createdAt");
CREATE INDEX "mcp_security_events_eventType_createdAt_idx" ON "mcp_security_events"("eventType", "createdAt");
