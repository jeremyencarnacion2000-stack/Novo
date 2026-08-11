-- Performance indexes are opportunistic because older baselines do not
-- contain every optional integration table/column yet. Skipping an index
-- whose source is absent keeps fresh isolated databases migratable; the
-- canonical Prisma schema remains the source for later additive migrations.
DO $$
BEGIN
  IF to_regclass('public.checklist_items') IS NOT NULL
     AND (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='checklist_items' AND column_name IN ('userId','source','sourceId')) = 3 THEN
    CREATE INDEX IF NOT EXISTS "checklist_items_userId_source_sourceId_idx" ON "checklist_items"("userId", "source", "sourceId");
  END IF;
  IF to_regclass('public.tasks') IS NOT NULL
     AND (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='tasks' AND column_name IN ('userId','updatedAt')) = 2 THEN
    CREATE INDEX IF NOT EXISTS "tasks_userId_updatedAt_idx" ON "tasks"("userId", "updatedAt");
  END IF;
  IF to_regclass('public.tasks') IS NOT NULL
     AND (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='tasks' AND column_name IN ('userId','status','updatedAt')) = 3 THEN
    CREATE INDEX IF NOT EXISTS "tasks_userId_status_updatedAt_idx" ON "tasks"("userId", "status", "updatedAt");
  END IF;
  IF to_regclass('public.analytics_events') IS NOT NULL
     AND (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='analytics_events' AND column_name IN ('userId','timestamp')) = 2 THEN
    CREATE INDEX IF NOT EXISTS "analytics_events_userId_timestamp_idx" ON "analytics_events"("userId", "timestamp");
  END IF;
  IF to_regclass('public.user_sessions') IS NOT NULL
     AND (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='user_sessions' AND column_name IN ('userId','startTime')) = 2 THEN
    CREATE INDEX IF NOT EXISTS "user_sessions_userId_startTime_idx" ON "user_sessions"("userId", "startTime");
  END IF;
  IF to_regclass('public.twin_evolution_logs') IS NOT NULL
     AND (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='twin_evolution_logs' AND column_name IN ('twinId','changeType','createdAt')) = 3 THEN
    CREATE INDEX IF NOT EXISTS "twin_evolution_logs_twinId_changeType_createdAt_idx" ON "twin_evolution_logs"("twinId", "changeType", "createdAt");
  END IF;
  IF to_regclass('public.checklist_items') IS NOT NULL
     AND (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='checklist_items' AND column_name IN ('userId','updatedAt')) = 2 THEN
    CREATE INDEX IF NOT EXISTS "checklist_items_userId_updatedAt_idx" ON "checklist_items"("userId", "updatedAt");
  END IF;
  IF to_regclass('public.focus_sessions') IS NOT NULL
     AND (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='focus_sessions' AND column_name IN ('userId','sessionType')) = 2 THEN
    CREATE INDEX IF NOT EXISTS "focus_sessions_userId_sessionType_idx" ON "focus_sessions"("userId", "sessionType");
  END IF;
END $$;
