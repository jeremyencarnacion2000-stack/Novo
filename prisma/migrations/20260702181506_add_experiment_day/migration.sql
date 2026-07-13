-- CreateTable
CREATE TABLE "experiment_days" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "blockIndex" INTEGER NOT NULL,
    "positionInBlock" INTEGER NOT NULL,
    "encryptedCondition" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "displayedWindowStart" TIMESTAMP(3),
    "displayedWindowEnd" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3),
    "subjectiveFocusScore" INTEGER,
    "subjectiveFatigueScore" INTEGER,
    "notes" TEXT,
    "revealedCondition" TEXT,
    "revealedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "experiment_days_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "experiment_days_userId_idx" ON "experiment_days"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "experiment_days_userId_date_key" ON "experiment_days"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "experiment_days_userId_dayNumber_key" ON "experiment_days"("userId", "dayNumber");

-- AddForeignKey
ALTER TABLE "experiment_days" ADD CONSTRAINT "experiment_days_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
