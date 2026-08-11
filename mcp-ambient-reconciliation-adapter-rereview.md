# MCP ambient reconciliation adapter re-review

Reviewed: follow-up to `bb0fb81` (2026-08-11)

## Resolution

The adapter no longer defaults an omitted verification field to `deterministic_match`. It now requires explicit canonical provider evidence (`verified_source_state`, `signed_webhook`, or `deterministic_match`) before it constructs a `NovoExternalObservation` or enters the reconciliation store. Omitted, `unverified`, and `inferred` evidence return `confirmation_required` with no projection, ledger, activity, or ordering lookup.

MCP remains a transport (`source: 'mcp'`, `actor: 'agent'`), not proof of provider state. A future route must derive the supplied canonical verification from an owned server-side provider read, verified provider delivery, or deterministic server-side match. The route remains intentionally unwired pending the documented durable mapping/order-state store.

## Verification

- Focused ambient-core and MCP-adapter tests pass.
- Targeted ESLint passes for the changed reconciliation files.
