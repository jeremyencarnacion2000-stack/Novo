-- Additive indexes for high-volume activity and routine history queries.
-- These remain non-unique because legacy data may contain duplicates; new
-- writes continue to use the application-level idempotency boundary.
CREATE INDEX "routine_days_routineId_order_idx" ON "routine_days"("routineId", "order");
CREATE INDEX "routine_exercises_dayId_order_idx" ON "routine_exercises"("dayId", "order");
CREATE INDEX "workout_logs_routineId_date_idx" ON "workout_logs"("routineId", "date");
CREATE INDEX "workout_exercise_logs_workoutLogId_idx" ON "workout_exercise_logs"("workoutLogId");
CREATE INDEX "routine_tasks_routineId_updatedAt_idx" ON "routine_tasks"("routineId", "updatedAt");
CREATE INDEX "routine_completions_routineId_completedAt_idx" ON "routine_completions"("routineId", "completedAt");
CREATE INDEX "tracker_entries_trackerId_date_idx" ON "tracker_entries"("trackerId", "date");
