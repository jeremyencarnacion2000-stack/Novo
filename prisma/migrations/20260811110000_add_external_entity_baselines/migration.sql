CREATE TABLE "external_entity_baselines" (
  "id" TEXT NOT NULL,
  "mappingId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "sourceEntityId" TEXT NOT NULL,
  "normalizedState" JSONB NOT NULL,
  "stateHash" TEXT NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "external_entity_baselines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "external_entity_baselines_mappingId_key" UNIQUE ("mappingId"),
  CONSTRAINT "external_entity_baselines_mappingId_fkey" FOREIGN KEY ("mappingId") REFERENCES "external_entity_mappings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "external_entity_baselines_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "external_entity_baselines_userId_provider_providerAccountId_sourceEntityId_idx" ON "external_entity_baselines"("userId", "provider", "providerAccountId", "sourceEntityId");
