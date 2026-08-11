# Continuous reconciliation audit review

Date: 2026-08-11. Review scope: independent repository spot-check of the pre-code audit only; no implementation was changed.

## Verdict

**SPEC: CONDITIONAL PASS.** The audit covers the required ten reconciliation questions (external ingest, identity, completion handling, Novo write-back, webhook/delta mechanism, background execution, calendar pull/watch/webhook, recommendation outcome mapping/recompute) and extends them with the relevant ledger, activity, mapping, test, and ownership questions. It uses all required verdict classes where warranted: `REAL`, `PARTIAL`, `MISSING`, `UNUSED`, and `BROKEN`.

**QUALITY: PASS WITH TWO MATERIAL CORRECTIONS.** The proven-versus-inferred boundary, source-to-Novo mapping, smallest safe reuse path, and blockers are clear and useful. The corrections below should be made before treating this as the final pre-code baseline.

## Independently verified samples

- `lib/todoist.ts` maps `/rest/v2/tasks` to `completed: false`; `app/api/integration/todoist/route.ts` upserts by `findFirst` on `(userId, source, sourceId)` and never reconciles missing active tasks. `ChecklistItem` has only a non-unique index for those columns.
- `IntegrationEngine.syncCompletion` first updates the local checklist item, then catches and logs Todoist close/reopen failures without durable recovery.
- `app/api/integration/calendar/route.ts` upserts `CalendarEvent`; `app/api/webhooks/calendar/route.ts` upserts/deletes `TimeBlock`, whose `googleEventId` is globally unique. No watch-registration call or persisted channel metadata was found.
- The Loop planner reads `Task`, not Todoist `ChecklistItem` or calendar entities; `NovoSignalInput.source` excludes `todoist`.
- MCP recommendation outcomes are transactionally persisted with `OutcomeEvent` and can mark the linked `Task` done; MCP `complete_task`/`start_task` do not create outcomes.

## Required corrections

1. **Correct the Todoist background/plugin-path verdict and wording.** The audit says the plugin's daily Inngest claim was not proven by source inspection. It is proven that `runDailyInsights()` calls `syncAllPlugins()` (`lib/inngest/functions/daily-insights.ts`), that `app/api/cron/daily-insights/route.ts` invokes that function, and that `vercel.json` declares the daily route. Actual deployed delivery remains unproven, but the code/configured periodic path is not `UNUSED`. Reclassify this row as **PARTIAL for periodic polling, BROKEN/insufficient for reconciliation**, and say it remains disconnected from the normal Todoist import and has no delivery-level correctness.

2. **Strengthen the Calendar cancellation finding.** `app/api/webhooks/calendar/route.ts` calls `calendar.events.list` without `showDeleted: true` (and without a sync token). The cancellation branch is therefore not dependable even for events inside the -7/+30-day window, not only for events outside it. Add this as direct evidence under the existing `BROKEN` webhook-processing row.

## Minor precision improvement

The proposed "same reconciliation transaction" cannot reuse `upsertNovoSignals` unchanged: `lib/cognitive/signal-ledger.ts` writes through the global Prisma client rather than accepting a transaction client. State that the new reconciliation boundary needs a transaction-aware ledger helper (or equivalent direct transaction writes) in addition to extending its allowed source vocabulary.

## Review conclusion

With those changes, the audit is a reliable implementation baseline. Its stated blockers remain valid: no provider delivery/cursor/idempotency store, split calendar ownership, no persisted Google watch lifecycle, planner inputs that exclude imported work, and no durable Todoist completion-write retry path.
