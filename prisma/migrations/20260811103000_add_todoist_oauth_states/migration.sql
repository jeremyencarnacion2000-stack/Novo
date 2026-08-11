CREATE TABLE "todoist_oauth_states" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "nonceHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'issued',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "todoist_oauth_states_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "todoist_oauth_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "todoist_oauth_states_nonceHash_key" ON "todoist_oauth_states"("nonceHash");
CREATE UNIQUE INDEX "todoist_oauth_states_provider_userId_nonceHash_key" ON "todoist_oauth_states"("provider", "userId", "nonceHash");
CREATE INDEX "todoist_oauth_states_expiresAt_status_idx" ON "todoist_oauth_states"("expiresAt", "status");
