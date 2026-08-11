# MCP ambient reconciliation adapter review

Reviewed commit: `bb0fb81` (2026-08-11)

## Verdict

**SPEC: FAIL — one material verification-boundary issue.** The adapter correctly reuses the ambient core, binds a complete verified relation, requires a provider revision, keeps MCP attribution, fails closed for identity/relation failures, and leaves recommendation outcomes alone. However, it turns omitted provider-verification evidence into `deterministic_match`. An authenticated MCP request establishes the Novo caller, not that a provider completion/revision/timestamp is canonical. This violates the required provider authentication/delivery-verification tier and permits a future route to project MCP-supplied completion fields without first reading/verifying the provider through the owned server-side connection.

**QUALITY: PASS WITH FOLLOW-UP.** The implementation is narrow, readable, intentionally unwired, and has useful focused coverage. Add the missing verification guard and its tests before any route/store integration; no change to the current route wiring status is warranted.

## SPEC findings

### [S1] Missing provider-verification evidence is upgraded to canonical

`lib/cognitive-reconciliation/mcp-provider-completion-reconciliation.ts:153` sets `verification` to `completion.verification ?? 'deterministic_match'`. That means a caller of this exported adapter can omit verification and still reach the core's canonical-verification allowlist. `source: 'mcp'` and `actor: 'agent'` accurately describe request attribution, but an MCP bearer token is not a signed provider delivery or a server-authenticated provider read.

This conflicts with the ambient architecture's required authentication/delivery-verification tier: provider state must be verified with a webhook signature/channel token or an owned server-side pull before entity lookup (`docs/novo-ambient-loop-architecture.md:89-91`). It also conflicts with the MCP rule that a provider refresh goes through the same canonical-observation/tiered engine, rather than bypassing ownership or dedupe (`docs/novo-ambient-loop-architecture.md:132-140`).

Required resolution: make verification evidence mandatory at this adapter boundary, or accept only a branded server-produced evidence object that cannot be constructed from MCP tool arguments. The future MCP tool should obtain this evidence from the provider using the owned connection, then pass `verified_source_state` (or another genuinely established canonical mode). Add a no-write test for omitted verification and for `unverified`/`inferred` values. Do not solve this by treating MCP authentication as provider verification.

## Verified contract alignment

- **Single ambient core, no parallel model:** the adapter normalizes one `NovoExternalObservation` and calls `createAmbientReconciliationService`; its bound store only narrows `findOwnedImportedEntities` to the verified relation ID. The commit adds no schema, migration, or replacement reconciliation engine.
- **Attribution:** normalized observations use `source: 'mcp'`, `actor: 'agent'`, and retain the provider as the ledger source. This is consistent with MCP being a transport rather than a provider identity.
- **Complete identity and ordering:** it requires nonblank provider, connection ID, provider account ID, entity type, source entity ID, source event ID, and external revision. The core retains provider-revision ordering and requires the injected `assessOrdering` result to be `newer`; timestamps are validated but not used as an ordering surrogate.
- **Fail-closed relation and ownership:** missing relations, cross-user relations, mismatched identity fields, blank relation IDs, and incomplete provider identity return `confirmation_required` before accessing the store. Once delegated, the core independently checks caller/owned connection, complete entity identity, unique entity resolution, pause state, and ordering.
- **Replay/atomicity:** replay uses the core fingerprint/ledger path and preserves its unique-claim (`P2002`) duplicate normalization. The focused test proves a replay with a changed observation timestamp does not project twice. The eventual Prisma store still must provide the documented transactional/durable implementation.
- **No implicit outcome behavior:** neither the adapter nor its store port exposes `RecommendedAction`, `OutcomeEvent`, or `Task` mutation methods. It projects only the imported lifecycle and returns the core's stale-plan disposition. `record_recommendation_outcome` remains separate.
- **Route remains honestly unwired:** repository search finds no production route importing this adapter. The adapter document accurately identifies the live schema gap: `ChecklistItem` has only `(userId, source, sourceId)` as a non-unique index and lacks connection/account identity, provider revision, and the durable reconciliation mapping/store required for safe wiring (`prisma/schema.prisma:218-238`).

## Test evidence

- `npm test -- --runInBand lib/cognitive-reconciliation/__tests__/mcp-provider-completion-reconciliation.test.ts` — pass, 7/7.

The suite covers valid attribution/delegation, same-core replay, missing/mismatched/cross-owner relations, incomplete identity, and the absence of recommendation/outcome mutation. It does not cover the required no-write behavior for omitted verification; currently that behavior is incorrect by construction.
