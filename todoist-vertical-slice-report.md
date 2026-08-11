# Todoist human-completion vertical slice report

Date: 2026-08-11

## Status

`IMPLEMENTED_POLICY / BLOCKED_PRODUCTION_PRIMITIVE`

The tested policy slice is complete at its dependency-injected boundary. Production activation remains blocked on the durable cursor, run-claim, and mapping-identity primitives detailed below; no route, cron, plugin, schema, or migration wiring is included.

## Delivered

- Added a dependency-injected, server-side Todoist reconciliation service that can be called without UI code. It obtains the selected project scope from an owned connection; callers cannot supply or widen that scope.
- The first successful selected-scope pull is a bootstrap. It creates only active `ChecklistItem` mappings through the injected store, advances the baseline cursor through the same store operation, and intentionally discards completion events from that baseline. It creates no ledger evidence, activity, behavioral learning, Novo `Task`, `RecommendedAction`, or `OutcomeEvent`.
- Later explicit Todoist completion events are normalized as verified `manual_sync` observations and passed to the existing `createAmbientReconciliationService`. That core alone determines ownership, pause, idempotency, ordering, exact mapping resolution, evidence, activity, and projection disposition.
- Active-task absence is never used as completion evidence. Post-bootstrap active snapshots are ignored by the reconciliation service.
- Added a bounded provider client: 1-20 explicitly selected projects, a bounded active-task request per project, and a bounded completion-capable activity request per selected project. Any provider error, malformed response, or full-limit response fails the whole pull before observations are returned. No provider call was made while implementing or testing this slice.
- Cursor advancement is fail closed: it happens only after every completion is projected, duplicate, or provably stale. Paused, missing, ambiguous, foreign/out-of-scope, or failed observations retain the old cursor. Earlier atomic projections remain replay-safe if a later item or final cursor write fails.

## Existing-model proof and production limit

`IntegrationAccount.metadata` is already the repository's persisted and preserved location for user-selected Todoist `projectIds`; it is suitable for reading the explicit scope after strict validation.

It is **not proven safe in this repository for a production reconciliation cursor/run claim**. JSON metadata has no schema-level shape or uniqueness for a run, the current Todoist routes perform whole-object metadata writes without an optimistic compare-and-swap contract, and `ChecklistItem` persists only `(userId, source, sourceId)`. It does not persist the core's connection/account/entity identity or per-entity ordering state, and its mapping index is not unique. An `IntegrationAccount` row does enforce one account per `(userId, provider)`, but that alone does not supply an atomic run/cursor state machine or prevent duplicate checklist mappings under concurrent writers.

Accordingly, this change adds no schema/migration and does not wire the provider client to the current route, cron, or plugin. The service/store port is fail closed until a production adapter can prove all of the following in one durable design:

1. optimistic or locked run claiming on the owned `IntegrationAccount`;
2. cursor/baseline advancement only after atomic projection success;
3. complete connection/account/entity mapping identity and unambiguous uniqueness;
4. crash-safe release/retry of an in-flight run.

This is a tested vertical policy slice and server-side service boundary, not a deployed background worker, webhook, production Todoist call, or external end-to-end proof.

## Focused evidence

- Fresh verification: `npx jest --runInBand --testPathPattern='lib/cognitive-reconciliation/__tests__/(todoist-human-reconciliation|todoist-reconciliation-client)\\.test\\.ts$'` passed **2 suites / 15 tests** on 2026-08-11.

- Bootstrap creates baseline mappings with no completion, evidence, activity, learning, recommendation, outcome, or Novo task mutation.
- One explicit completion projects exactly one owned imported item through the corrected ambient core and creates only ledger/activity evidence.
- Replay deduplication, missing/ambiguous mapping quarantine, cross-user isolation, source pause, partial projection failure, final-cursor failure, selected-scope authorization, provider partial/truncated response rejection, and active-task absence non-inference are covered.
