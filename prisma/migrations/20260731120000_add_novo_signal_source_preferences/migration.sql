CREATE TABLE "novo_signal_source_preferences" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "excludedAt" TIMESTAMP(3),
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "novo_signal_source_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "novo_signal_source_preferences_userId_source_key" ON "novo_signal_source_preferences"("userId", "source");
CREATE INDEX "novo_signal_source_preferences_userId_excludedAt_idx" ON "novo_signal_source_preferences"("userId", "excludedAt");
ALTER TABLE "novo_signal_source_preferences" ADD CONSTRAINT "novo_signal_source_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
