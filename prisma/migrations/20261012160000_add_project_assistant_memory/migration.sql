CREATE TABLE "project_assistant_memories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "trackingMode" TEXT NOT NULL DEFAULT 'auto',
    "correction" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "clearedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "project_assistant_memories_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "project_assistant_sources" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memoryId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "repository" TEXT,
    "vercelProjectId" TEXT,
    "deviceId" TEXT,
    "facts" JSONB NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "lastAttemptAt" TIMESTAMP(3),
    "availability" TEXT NOT NULL DEFAULT 'available',
    CONSTRAINT "project_assistant_sources_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "project_assistant_memories_userId_clearedAt_updatedAt_idx" ON "project_assistant_memories"("userId", "clearedAt", "updatedAt");
CREATE INDEX "project_assistant_memories_userId_projectId_idx" ON "project_assistant_memories"("userId", "projectId");
CREATE UNIQUE INDEX "project_assistant_sources_userId_kind_sourceKey_key" ON "project_assistant_sources"("userId", "kind", "sourceKey");
CREATE INDEX "project_assistant_sources_userId_memoryId_idx" ON "project_assistant_sources"("userId", "memoryId");
CREATE INDEX "project_assistant_sources_userId_deviceId_idx" ON "project_assistant_sources"("userId", "deviceId");
ALTER TABLE "project_assistant_memories" ADD CONSTRAINT "project_assistant_memories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_assistant_memories" ADD CONSTRAINT "project_assistant_memories_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_assistant_sources" ADD CONSTRAINT "project_assistant_sources_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_assistant_sources" ADD CONSTRAINT "project_assistant_sources_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "project_assistant_memories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
