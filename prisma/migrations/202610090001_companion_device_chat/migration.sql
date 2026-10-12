-- Candidate only: no persistent migration recorded. The device-only draft
-- was validated in a disposable schema; this complete migration is additive.
CREATE TABLE "companion_devices" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deviceId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "grantId" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL,
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastVerifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "companion_devices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "companion_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "companion_devices_userId_deviceId_key" ON "companion_devices"("userId", "deviceId");
CREATE INDEX "companion_devices_userId_revokedAt_connectedAt_idx" ON "companion_devices"("userId", "revokedAt", "connectedAt");
ALTER TABLE "AIConversation" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "user_chat_leases" (
  "userId" TEXT NOT NULL PRIMARY KEY,
  "requestId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_chat_leases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "companion_chat_turns" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "requestId" UUID NOT NULL,
  "conversationId" TEXT,
  "deviceId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "grantId" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "leaseExpiresAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "userMessageId" UUID NOT NULL,
  "assistantMessageId" UUID,
  "initialRevision" INTEGER NOT NULL,
  "resultRevision" INTEGER,
  "modelId" TEXT,
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "companion_chat_turns_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "companion_chat_turns_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "companion_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "companion_chat_turns_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "companion_chat_turns_userId_requestId_key" ON "companion_chat_turns"("userId", "requestId");
CREATE INDEX "companion_chat_turns_userId_status_idx" ON "companion_chat_turns"("userId", "status");
CREATE INDEX "companion_chat_turns_expiresAt_idx" ON "companion_chat_turns"("expiresAt");
