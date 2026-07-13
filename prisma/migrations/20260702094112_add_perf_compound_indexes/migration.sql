-- CreateIndex
CREATE INDEX "checklist_items_userId_completed_idx" ON "checklist_items"("userId", "completed");

-- CreateIndex
CREATE INDEX "tasks_userId_status_idx" ON "tasks"("userId", "status");

-- CreateIndex
CREATE INDEX "direct_messages_senderId_receiverId_idx" ON "direct_messages"("senderId", "receiverId");

-- CreateIndex
CREATE INDEX "direct_messages_receiverId_senderId_idx" ON "direct_messages"("receiverId", "senderId");
