-- Existing rows remain nullable so this additive migration does not rewrite or
-- delete a user's library. Every new write receives a deterministic identity.
ALTER TABLE "books" ADD COLUMN "identityKey" TEXT;

CREATE UNIQUE INDEX "books_userId_identityKey_key"
ON "books"("userId", "identityKey");
