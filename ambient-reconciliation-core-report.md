# Ambient reconciliation core report

Date: 2026-08-11

## Delivered

- Added the pure, dependency-injected service in `lib/cognitive-reconciliation/ambient-reconciliation.ts`.
- Defined `NovoExternalObservation` with caller-independent ownership attribution, provider connection/account identity, source/event/entity identity, actor and timestamps, verification, raw-content retention flag, and bounded link metadata.
- Reused the existing `NovoSignalLedger`, `RecommendedAction`, `OutcomeEvent`, `AiActivityRun`, `AiActivityEvent`, and source-preference semantics through a transaction-shaped store port. No schema, migration, provider adapter, connector, MCP tool, or route was added.
- A verified, unambiguous completion claims one stable ledger fingerprint, completes one owned recommendation, writes one attributable outcome, and writes one terminal activity run/event in the same atomic boundary.
- Only `verified_source_state`, `signed_webhook`, and `deterministic_match` may complete an action. Missing, mismatched, ambiguous, foreign, paused, stale, or unverified observations are no-ops with an explicit disposition.
- The completion invalidates the recommendation and returns `learningEligible: false`; no `BehavioralSignal` or other learning record is emitted.
- Concurrent unique-claim loss (`P2002`) is normalized to `duplicate`, preventing duplicate ledger, outcome, and activity records.

## Verification

- Focused Jest: 1 suite, 15 tests passed.
- Focused ESLint: passed with zero diagnostics.
- Focused TypeScript (`strict`, `ES2022`, bundler resolution): passed with zero diagnostics.

The tests cover stable replay idempotency, concurrent claim races, distinct stale out-of-order events, ambiguous/missing/mismatched links, caller and connection ownership, defensive linked-action ownership, source pause, all canonical and non-canonical verification modes, exact completion attribution, activity fields, recommendation invalidation, and the one-event learning gate.

## Integration boundary

The eventual Prisma adapter must implement `ReconciliationStore.runAtomically` with `prisma.$transaction`, scope connection/action queries by the authenticated caller, map `NovoSignalSourcePreference.excludedAt` to source pause, and preserve the existing unique constraints. Route and provider verification wiring are intentionally outside this change.

## Round 1 architecture correction

This section supersedes the original completion-path description above.

- Removed every `RecommendedAction` lookup/update and every `OutcomeEvent` create from the reconciliation contract. An external observation can no longer overwrite proposed, postponed, dismissed, completed, or any other recommendation state.
- Added `externalRevision?`, `fetchedAt`, `syncRunId?`, and `deliveryId?` to `NovoExternalObservation`. Delivery/event identity remains fingerprint input only and is never treated as ordering evidence.
- Projection now requires either a provider-documented revision or a serialized `full_pull`/`manual_sync` run, plus an injected provider-aware ordering assessment. Missing, tied, overlapping, mismatched, or unknown ordering is quarantined as `confirmation_required`; a provably older provider revision is a stale no-op. `occurredAt`, `observedAt`, and receive timing are not compared by the core.
- The only mutable target is one imported entity resolved by the complete owned tuple: Novo user, provider, connection, provider account, entity type, and source entity ID. Missing, ambiguous, or cross-owner mappings are no-ops.
- A successful projection atomically claims one existing `NovoSignalLedger` fingerprint, projects the imported lifecycle through the injected primitive, and creates one existing Activity run/event. It returns `recommendationInvalidated: false`, `stalePlanDisposition: 'mark_stale'`, and `learningEligible: false`. No behavioral-learning write is emitted from this one event.
- No schema, migration, route, connector, MCP tool, second ledger, or provider adapter was added.

Round 1 verification: focused Jest passed 14/14 tests; focused ESLint and focused strict TypeScript passed with zero diagnostics. Coverage includes replay and concurrent idempotency, complete-identity ownership, provider/transport pause, revision-based stale ordering despite later timestamps, unknown/tied/overlap quarantine, serialized sync-run ordering, missing/ambiguous entity mappings, no recommendation/outcome mutation, Activity fields, and the learning gate.
