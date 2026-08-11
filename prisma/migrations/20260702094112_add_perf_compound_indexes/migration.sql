-- CreateIndex
CREATE INDEX "checklist_items_userId_completed_idx" ON "checklist_items"("userId", "completed");

-- CreateIndex
CREATE INDEX "tasks_userId_status_idx" ON "tasks"("userId", "status");

DO $$
BEGIN
  -- The original baseline omitted this legacy social table on fresh
  -- databases. Keep the index migration replayable when it is absent.
  IF to_regclass('public.direct_messages') IS NOT NULL THEN
    CREATE INDEX "direct_messages_senderId_receiverId_idx" ON "direct_messages"("senderId", "receiverId");
    CREATE INDEX "direct_messages_receiverId_senderId_idx" ON "direct_messages"("receiverId", "senderId");
  END IF;
END $$;
