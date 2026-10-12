-- Persist the attribution controls in the quick-capture surface. Ownership is
-- still validated by the API before a project id is stored.
ALTER TABLE "quick_notes"
ADD COLUMN "projectId" TEXT,
ADD COLUMN "dueDate" TEXT;

CREATE INDEX "quick_notes_userId_projectId_idx" ON "quick_notes"("userId", "projectId");

ALTER TABLE "quick_notes"
ADD CONSTRAINT "quick_notes_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
