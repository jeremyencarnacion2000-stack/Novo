# Ambient reconciliation core re-review

Reviewed: commit `bf4134d` (2026-08-11)

## Verdict

**PASS.** The boundary corrections requested in `ambient-reconciliation-core-review-retry.md` are present in the scoped core diff. No new schema or migration is included.

## Verified

- The core has no `RecommendedAction`, `OutcomeEvent`, or `Task` mutation path. It projects only the uniquely resolved imported entity and reports a stale planning disposition.
- Imported-entity resolution and defensive candidate validation use the complete owned identity: user, provider, connection, provider account, entity type, and source entity ID.
- Ordering is not inferred from event/receive timestamps. Projection needs a non-blank provider revision or a `full_pull`/`manual_sync` observation with a sync-run ID and valid `fetchedAt`; the injected provider-aware assessment quarantines mismatched, tied, overlapping, and unknown order. A provably older revision returns `stale` before every write.
- Caller/connection ownership and provider/transport pause checks happen before writes. The stable ledger fingerprint carries the complete entity and delivery identity; preflight lookup plus `P2002` normalization preserves successful-delivery replay/race idempotency.
- The ledger claim, imported projection, and one Activity run/event remain inside the store atomic boundary. `learningEligible` stays `false`. No recommendation/outcome write is hidden in the fake test store.

## Verification

- `npm test -- --runInBand lib/cognitive-reconciliation/__tests__/ambient-reconciliation.test.ts` — pass (14/14).
- Focused ESLint completed with zero diagnostics before the time-bounded full TypeScript check was stopped. The full project TypeScript result is therefore not asserted by this re-review.

## Integration qualification

This is a core-contract review. The eventual adapter must still provide a real Prisma transaction and a provider-documented `assessOrdering` implementation, as the delivery report already states; neither is implemented by this commit.
