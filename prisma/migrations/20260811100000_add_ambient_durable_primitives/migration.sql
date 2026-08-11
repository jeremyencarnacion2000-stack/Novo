-- Additive durable primitives for ambient reconciliation.
ALTER TABLE "integration_accounts"
  ADD COLUMN "syncCursor" TEXT,
  ADD COLUMN "syncCursorUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "lastSyncRunId" TEXT,
  ADD COLUMN "lastSyncedAt" TIMESTAMP(3);

CREATE TABLE "external_entity_mappings" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "integrationAccountId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "sourceEntityId" TEXT NOT NULL,
  "internalType" TEXT NOT NULL,
  "internalId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "canonicalBaseline" JSONB,
  "sourceRevision" TEXT,
  "lastObservedAt" TIMESTAMP(3),
  "unlinkedAt" TIMESTAMP(3),
  "unlinkReason" TEXT,
  "correctedAt" TIMESTAMP(3),
  "correctionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "external_entity_mappings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "external_entity_mappings_identity_key" ON "external_entity_mappings" ("userId","provider","providerAccountId","entityType","sourceEntityId");
CREATE INDEX "external_entity_mappings_internal_idx" ON "external_entity_mappings" ("userId","internalType","internalId");
CREATE INDEX "external_entity_mappings_account_idx" ON "external_entity_mappings" ("integrationAccountId","entityType","status");
ALTER TABLE "external_entity_mappings" ADD CONSTRAINT "external_entity_mappings_user_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "external_entity_mappings" ADD CONSTRAINT "external_entity_mappings_account_fkey" FOREIGN KEY ("integrationAccountId") REFERENCES "integration_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ambient_reconciliation_claims" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "sourceEntityId" TEXT NOT NULL,
  "sourceEventId" TEXT,
  "deliveryId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "providerRevision" TEXT,
  "syncRunId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "claimedAt" TIMESTAMP(3),
  "claimExpiresAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ambient_reconciliation_claims_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ambient_reconciliation_claims_idempotency_key" ON "ambient_reconciliation_claims" ("userId","idempotencyKey");
CREATE INDEX "ambient_reconciliation_claims_status_idx" ON "ambient_reconciliation_claims" ("userId","status","createdAt");
CREATE INDEX "ambient_reconciliation_claims_identity_idx" ON "ambient_reconciliation_claims" ("provider","providerAccountId","entityType","sourceEntityId");
ALTER TABLE "ambient_reconciliation_claims" ADD CONSTRAINT "ambient_reconciliation_claims_user_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
