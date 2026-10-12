# Novo idempotency audit — 2026-09-05

## Rule

A retry must converge on the result of one user intent. It must **not** infer
that two equal titles are accidental: creating two tasks called “Call Mom” can
be intentional. Durable request identity, scoped to the owner and operation,
is therefore the correct boundary for ordinary creates.

## Verified boundaries

| Flow | Durable boundary | Retry result | Evidence |
| --- | --- | --- | --- |
| Library catalog import/manual add | `Book(userId, identityKey)` plus a short user/title/author advisory lock around lookup-and-create | Existing owned book is returned, including concurrent retries whose catalog metadata differs slightly | `app/api/books/route.test.ts`, `app/api/books/route.ts` |
| Template use | `MutationRequest(userId, scope, idempotencyKey)` in same transaction as resource creation | Original routine/project/tracker is returned | `app/api/templates/use/route.test.ts` |
| User template create | `MutationRequest(userId, template_create, idempotencyKey)` in one transaction | Original owned template is returned; malformed payloads are rejected before the write | `app/api/templates/route.test.ts` |
| Project create | `MutationRequest(userId, project_create, idempotencyKey)` in one transaction | Original owned project is returned | `app/api/projects/route.test.ts` |
| Task create | `MutationRequest(userId, task_create, idempotencyKey)` in one transaction | Original owned task is returned | `app/api/tasks/route.test.ts` |
| Routine create | `MutationRequest(userId, routine_create, idempotencyKey)` in one transaction | Original owned routine is returned | `app/api/routines/route.test.ts` |
| Tracker create | `MutationRequest(userId, tracker_create, idempotencyKey)` in one transaction | Original owned tracker is returned | `app/api/trackers/route.test.ts` |
| Routine import batch | `MutationRequest(userId, routine_import_batch, idempotencyKey)` in the same transaction as all child writes | Completed imports replay without duplicating routines, trackers or checklists; a changed payload conflicts | `app/api/routines/import-batch/route.test.ts` |
| Note / quick capture | `MutationRequest(userId, note_create, idempotencyKey)` in one transaction | Original owned note is returned; capture type and owned project/date attribution persist | `app/api/notes/route.test.ts` |
| Goal create | `MutationRequest(userId, goal_create, idempotencyKey)` in one transaction | Original owned goal is returned | `app/api/goals/route.test.ts` |
| Native calendar event | `MutationRequest(userId, calendar_event_create, idempotencyKey)` in one transaction | Original owned Novo event is returned; ambient recomputation runs once | `app/api/calendar/events/route.test.ts` |
| Time block + Google Calendar | `MutationRequest(userId, timeblock_create, idempotencyKey)` reserves the owned block; deterministic Google event ID is reused on replay | Original owned block is returned and a failed provider write can be retried without a duplicate event | `app/api/timeblocks/create/route.ts` |
| Activity history / workout / quick note | Route-scoped `MutationRequest` in the same transaction as the local write | Original owned record is returned on replay | `app/api/activity-history/route.ts`, `app/api/fitness/workout/route.ts`, `app/api/quick-notes/route.ts` |
| Checklist / gratitude / daily steps | Route-scoped `MutationRequest` in the same transaction as the local write | Original owned item is returned on replay; offline queue preserves the key | `app/api/checklist/route.ts`, `app/api/gratitudes/route.ts`, `app/api/fitness/steps/route.ts`, `lib/data-integrator.ts` |
| Provider action dispatch | `ExternalActionExecution(userId, provider, operation, idempotencyKey)` | Provider operation is claimed before dispatch | Prisma schema + provider action service |
| MCP mutation | `McpAuditLog(userId, clientId, idempotencyKey)` | Client action is deduplicated and audited | Prisma schema + MCP tests |
| Ambient provider delivery | `AmbientReconciliationClaim(userId, idempotencyKey)` | Provider observation is claimed/replayed safely | reconciliation test suite |
| Cognitive completion | `OutcomeEvent.idempotencyKey` / durable replan request | One outcome/handoff per observation | cognitive completion tests |
| Tracker entry log | `MutationRequest(userId, tracker_entry, idempotencyKey)` plus a tracker/date upsert in a short Postgres advisory-lock transaction | Replays return the owned entry; same-day updates do not create a second row; analytics runs only for a new entry | `app/api/trackers/[id]/entries/route.test.ts` |
| Todoist / Notion checklist reconciliation | Provider-scoped Postgres advisory-lock transaction around find-then-create/update | Concurrent heartbeat and manual syncs converge on one provider item without requiring a destructive cleanup or a title-based uniqueness rule | `lib/provider-sync-lock.ts`, provider plugin/route tests |
| AI workout start/finish and grade creation | `MutationRequest(userId, scope, idempotencyKey)` in the executor; finish replays the owned workout log and its child exercises | Chat retries return the original session/grade instead of adding a second log, exercise set or grade | `lib/ai/executor.ts`, `lib/ai/__tests__/executor.test.ts` |
| Analytics `UserSession` start | Optional client intent ID stored as the session ID; owned replay returns the existing session and a foreign ID is rejected | React Strict Mode/dropped-response retries do not create duplicate analytics sessions; the intent is retained until success | `app/api/analytics/route.ts`, `lib/analytics.ts`, `hooks/use-session-tracking.ts`, `app/api/analytics/route.test.ts` |

## Explicit remaining work

The ordinary creation surfaces above accept the common `Idempotency-Key`.
Project, Routine, Tracker, Quick Capture, Goals, the operating loop, native
Calendar, time blocks, fitness, activity history and quick notes retain it for
one in-flight intent. Titles/content must not be made unique as a shortcut.
Clients should retain a generated key only until the current create intent
succeeds; provider-backed flows should replay the same external identity.

Tracker entry clients now retain a key per tracker/date/value until success;
the server also serializes the tracker/date upsert so two simultaneous writes
cannot race into duplicate rows. The endpoint still accepts legacy requests
without a key, but those requests are wrapped in the same upsert transaction.

Routine import clients retain one key for the active file/selection until the
batch succeeds, so a transient network retry cannot insert a second copy. A
new import dialog starts a fresh intent key.

Do not declare **global user-CRUD idempotency** certified until those routes
have adopted that protocol and each has a replay/race test. This document is
intended to make the boundary explicit rather than silently overclaim it.

## Migration dependency

The verified routes depend on these additive migrations being applied before
their code is released:

1. `20260905120000_add_book_idempotency_key`
2. `20260905123000_add_mutation_request_idempotency`
3. `20260905124500_add_quick_note_attributes`
4. `20260905130000_add_device_activity_surface`

Run `prisma migrate deploy` only against the confirmed target environment,
then validate the deployed routes with an authenticated replay test.
