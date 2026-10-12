CREATE TABLE "companion_activity_daily_summaries" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "day" DATE NOT NULL,
  "applicationId" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "durationSeconds" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "companion_activity_daily_summaries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "companion_activity_daily_summaries_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "companion_activity_daily_summaries_userId_deviceId_day_applicationId_state_key"
  ON "companion_activity_daily_summaries"("userId", "deviceId", "day", "applicationId", "state");
CREATE INDEX "companion_activity_daily_summaries_userId_day_idx"
  ON "companion_activity_daily_summaries"("userId", "day");
CREATE INDEX "companion_activity_daily_summaries_expiresAt_idx"
  ON "companion_activity_daily_summaries"("expiresAt");
