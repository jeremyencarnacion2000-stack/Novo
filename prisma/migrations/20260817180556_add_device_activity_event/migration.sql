-- CreateTable
CREATE TABLE "DeviceActivityEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeviceActivityEvent_userId_startedAt_idx" ON "DeviceActivityEvent"("userId", "startedAt");

-- AddForeignKey
ALTER TABLE "DeviceActivityEvent" ADD CONSTRAINT "DeviceActivityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
