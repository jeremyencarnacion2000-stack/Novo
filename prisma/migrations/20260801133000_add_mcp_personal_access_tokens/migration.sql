CREATE TABLE "mcp_personal_access_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "scopes" TEXT[] NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_personal_access_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mcp_personal_access_tokens_tokenHash_key" ON "mcp_personal_access_tokens"("tokenHash");
CREATE INDEX "mcp_personal_access_tokens_userId_revokedAt_expiresAt_idx" ON "mcp_personal_access_tokens"("userId", "revokedAt", "expiresAt");

ALTER TABLE "mcp_personal_access_tokens"
  ADD CONSTRAINT "mcp_personal_access_tokens_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
