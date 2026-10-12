-- Durable request keys for user-initiated creation flows. The resource itself
-- and this record are written in one Prisma transaction by the route handler.
CREATE TABLE "mutation_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mutation_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mutation_requests_userId_scope_idempotencyKey_key"
ON "mutation_requests"("userId", "scope", "idempotencyKey");

CREATE INDEX "mutation_requests_userId_createdAt_idx"
ON "mutation_requests"("userId", "createdAt");

ALTER TABLE "mutation_requests"
ADD CONSTRAINT "mutation_requests_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
