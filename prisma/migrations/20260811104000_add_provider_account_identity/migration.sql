ALTER TABLE "integration_accounts" ADD COLUMN "providerAccountId" TEXT;
CREATE INDEX "integration_accounts_provider_providerAccountId_idx" ON "integration_accounts"("provider", "providerAccountId");
