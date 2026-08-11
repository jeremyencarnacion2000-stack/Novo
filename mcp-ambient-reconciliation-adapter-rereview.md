# MCP ambient reconciliation adapter re-review

Reviewed commit: `fff4940` (2026-08-11)

## Verdict

**PASS.** The prior provider-verification boundary finding is resolved; no new material issue was found in this scoped re-review.

## Verified resolution

- The adapter admits only `verified_source_state`, `signed_webhook`, and `deterministic_match` as canonical provider verification (`lib/cognitive-reconciliation/mcp-provider-completion-reconciliation.ts:13-17`).
- Missing evidence returns `confirmation_required` / `verification_evidence_missing`, and `unverified` or `inferred` returns `confirmation_required` / `verification_not_canonical` (`:135-140`). There is no fallback or default to `deterministic_match`.
- These guards occur before construction of `NovoExternalObservation` (`:149`) and before `createAmbientReconciliationService` receives the relation-bound store (`:170-173`). Thus invalid evidence cannot call `runAtomically` or any reconciliation-store method.
- Once accepted, the observation carries the caller-supplied canonical verification unchanged (`:165`); MCP remains transport attribution (`source: 'mcp'`, `actor: 'agent'`) rather than provider proof (`:154-160`).

## Test evidence

- `lib/cognitive-reconciliation/__tests__/mcp-provider-completion-reconciliation.test.ts:148-161` covers omitted, `unverified`, and `inferred` evidence; each asserts the correct quarantine result and no projection, ledger, run, or ordering observation.
- `npm test -- --runInBand lib/cognitive-reconciliation/__tests__/mcp-provider-completion-reconciliation.test.ts` — pass (10/10).
- `npx eslint lib/cognitive-reconciliation/mcp-provider-completion-reconciliation.ts lib/cognitive-reconciliation/__tests__/mcp-provider-completion-reconciliation.test.ts` — pass.

The adapter remains intentionally unwired, so the documented requirement for a future route to derive canonical evidence from an owned provider connection or verified provider delivery remains intact.
