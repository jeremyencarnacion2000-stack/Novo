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
