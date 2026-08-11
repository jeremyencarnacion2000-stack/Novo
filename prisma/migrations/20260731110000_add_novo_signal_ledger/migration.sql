CREATE TABLE "novo_signal_ledger" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "sourceRef" TEXT,
  "signalType" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL,
  "reliability" TEXT NOT NULL DEFAULT 'direct',
  "excludedAt" TIMESTAMP(3),
  "exclusionReason" TEXT,
  "correctedAt" TIMESTAMP(3),
  "correction" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "novo_signal_ledger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "novo_signal_ledger_userId_fingerprint_key" ON "novo_signal_ledger"("userId", "fingerprint");
CREATE INDEX "novo_signal_ledger_userId_excludedAt_observedAt_idx" ON "novo_signal_ledger"("userId", "excludedAt", "observedAt");
CREATE INDEX "novo_signal_ledger_userId_source_sourceRef_idx" ON "novo_signal_ledger"("userId", "source", "sourceRef");
ALTER TABLE "novo_signal_ledger" ADD CONSTRAINT "novo_signal_ledger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
