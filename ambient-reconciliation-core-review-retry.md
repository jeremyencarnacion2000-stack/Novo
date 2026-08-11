# Ambient reconciliation core retry review

Reviewed: commit `7736d48` (2026-08-11)

## Verdict

**SPEC: FAIL.** The implementation demonstrates useful local guards, but it crosses two explicit architecture boundaries: it infers a `RecommendedAction`/`OutcomeEvent` completion from an external observation, and it treats a bare event timestamp as sufficient ordering evidence. Neither is permitted by the corrected ambient-loop contract.

**QUALITY: NEEDS REWORK.** The focused suite passes (15/15), and the dependency-injected shape is testable, but the tests codify the primary specification violation and do not exercise the unknown-ordering or terminal-state cases.

## Load-bearing findings

1. **[P0, SPEC] External evidence automatically completes a Novo recommendation and writes an outcome.**
   `lib/cognitive-reconciliation/ambient-reconciliation.ts:268` through `:300` completes the linked `RecommendedAction` and creates an `OutcomeEvent` after any canonical external completion. This conflicts with the corrected architecture: an external completion must not silently change a `Task`, `RecommendedAction`, or `OutcomeEvent` without an explicit verified relation (`docs/novo-ambient-loop-architecture.md:124`), and inferred provider state must not replace a manually confirmed decision (`:112`). The current architecture limits the fast loop to safe stale-state invalidation (`:11`, `:125`). This must be removed or kept quarantined until the explicit relation and allowed policy are implemented.

2. **[P0, SPEC] Timestamp comparison is used as an unsupported ordering protocol.**
   `ambient-reconciliation.ts:244` through `:252` accepts a newer `occurredAt` and rejects an equal/older one, without a documented monotonic provider revision/delta sequence or identified serialized snapshot run. The contract permits ordering only with that provider guarantee and requires ties, overlaps, missing comparison bases, and indeterminate ordering to be quarantined unchanged (`docs/novo-ambient-loop-architecture.md:91`). The test at `ambient-reconciliation.test.ts:162` only demonstrates an older timestamp, so it misses the required no-revision/unknown-ordering path.

3. **[P1, SPEC] A provider completion can overwrite user terminal choices other than `completed`.**
   The sole terminal guard is `action.status === 'completed'` at `ambient-reconciliation.ts:253`; a dismissed, postponed, or otherwise terminal recommendation can therefore be set to `completed` by the following unconditional update at `:268`. This is also contrary to the manually confirmed-decision protection in architecture line 112. The focused suite has no non-`completed` terminal-state test.

4. **[P0, SPEC] The complete provider-entity identity is fingerprinted but never used to resolve the mutable target.**
   The lookup at `ambient-reconciliation.ts:230-239` selects a recommendation solely from `metadata.recommendedActionId` and/or `metadata.sourceRef`; it does not resolve an owned local entity using provider, connection/account, entity type, and source entity ID. The corrected contract requires exactly that complete-identity resolution and treats a missing/ambiguous mapping as a quarantined no-op (`docs/novo-ambient-loop-architecture.md:68`, `:92`, `:123`). A fingerprint prevents duplicate deliveries; it does not prove that a provider entity has an explicit verified relation to a recommendation.

## Verified safeguards

- **Ownership tuple:** caller attribution is checked before the transaction (`ambient-reconciliation.ts:193-206`), and the lookup contains user, provider, connection, and provider account. The fingerprint additionally contains user, provider, connection/account, entity type, and source entity (`:169-180`). This is a correct identity claim/deduplication tuple, but finding 4 explains why it is not sufficient entity-resolution proof.
- **Pause:** source pause exits before any writes (`ambient-reconciliation.ts:208-210`); covered by `ambient-reconciliation.test.ts:250-261`.
- **Replay/idempotency:** the stable fingerprint excludes receive-time and metadata (`ambient-reconciliation.ts:164-180`), is prechecked (`:212-215`), and is protected by the existing `NovoSignalLedger @@unique([userId, fingerprint])` constraint (`prisma/schema.prisma:826-846`). The focused replay/race tests cover the intended success path (`ambient-reconciliation.test.ts:130-160`).
- **Ambiguous/missing links:** these return confirmation-required before writes (`ambient-reconciliation.ts:228-239`); the no-write cases are tested at `ambient-reconciliation.test.ts:178-217`.
- **One-event learning:** the service exposes `learningEligible: false` on all paths and has no behavioral-learning store method or write (`ambient-reconciliation.ts:130-139`, `:327-335`); covered at `ambient-reconciliation.test.ts:291-360`.
- **Schema scope:** `git diff 7736d48^ 7736d48 -- prisma/schema.prisma prisma/migrations` is empty. No schema or migration was added.

## Atomicity and exact-write qualification

For its permitted happy path, the service makes one call each to create the ledger, update the recommendation, create the outcome, create the activity run, and create the activity event (`ambient-reconciliation.ts:258-325`) inside `runAtomically`. That supports the intended exactly-one property only when the eventual adapter supplies a true database transaction. The in-memory test store's `runAtomically` merely calls its callback (`ambient-reconciliation.test.ts:38-40`), so it cannot prove rollback of a failure after the ledger/action write or adapter-level uniqueness behavior. The delivery report already correctly identifies the missing Prisma transaction adapter as future integration work (`ambient-reconciliation-core-report.md:23-25`).

## Verification

`npm test -- --runInBand lib/cognitive-reconciliation/__tests__/ambient-reconciliation.test.ts` passed: 1 suite, 15 tests.
