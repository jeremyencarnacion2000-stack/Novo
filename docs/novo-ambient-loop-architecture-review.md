# Novo ambient loop architecture review

Date: 2026-08-11. Scope: `docs/novo-ambient-loop-architecture.md`, the corrected reconciliation audit and rereview, plus targeted source checks of the cited Todoist, MCP, and Prisma paths. This is a documentation review only; no product code, schema, migration, provider configuration, or external state was changed.

## Verdict

**SPEC: CONDITIONAL PASS.** The document keeps the fast reconciliation loop separate from the slow cognitive loop, reuses existing Novo surfaces only within their demonstrated roles, and explicitly labels `CanonicalObservation`, the policy table, and the vertical slice as planned rather than current code. It does not smuggle in a schema or implementation change. Ownership, delivery verification, idempotency, entity resolution, atomic projection, privacy, proactivity, and confirmation gates are all explicit.

It also faithfully carries the corrected audit's important limits: Todoist's periodic plugin is a source/configuration-proven polling path but not correct reconciliation; Todoist active-task pulls cannot prove completion; Calendar has split local ownership and no watch lifecycle, sync token, or deletion-correct query; and MCP audit/idempotency is not provider-delivery idempotency.

**QUALITY: PASS WITH FOUR REQUIRED CORRECTIONS.** Apply the clarifications below before using this as the implementation gate for an ambient reconciliation boundary.

## Required corrections

1. **[High] Do not imply that a connected provider authorizes outbound writes.**

   The fast-loop row says it may perform "provider synchronization explicitly authorized by a user connection" (`docs/novo-ambient-loop-architecture.md:11`), while the later policy correctly requires explicit confirmation for Novo-to-provider changes (`docs/novo-ambient-loop-architecture.md:97-99`). A connection and read scope do not authorize a background close/reopen, calendar mutation, notification, or other provider write. This is particularly important because the current Todoist completion write-back is best-effort rather than a safe ambient boundary.

   Replace that table cell with an unambiguous rule: **"No autonomous external writes. The fast loop may read from a user-authorized connection and project verified data into Novo; every Novo-to-provider write remains a CONFIRM action through a durable external-write boundary."** Keep recommendation creation in the slow loop and stale-state invalidation as the fast-loop maximum.

2. **[High] Define safe ordering when a provider supplies no monotonic revision.**

   The contract permits optional `externalRevision`/`deliveryId` and a fingerprint fallback (`docs/novo-ambient-loop-architecture.md:51-58`); tier 3 nevertheless requires older observations to be no-ops (`docs/novo-ambient-loop-architecture.md:85`). A payload fingerprint only deduplicates an identical full pull. It cannot establish whether a different late snapshot is older than already-projected state. `receivedAt` must not become an ordering surrogate.

   Add a tier-3 rule that ordering is used only when the provider documents an entity/account-scoped monotonic revision or delta sequence. For a full/manual pull without that guarantee, serialize or identify the sync run, treat its response as a bounded authoritative snapshot only within that run, and quarantine/leave state unchanged on an overlapping or indeterminate observation. State explicitly that a delivery ID deduplicates delivery but does not itself establish event order.

3. **[Medium] Resolve the contradiction between "missing mapping quarantines" and the Todoist bootstrap slice.**

   Tier 4 says a missing mapping is never an automatic create/update/delete (`docs/novo-ambient-loop-architecture.md:86`), but the Todoist slice expects each accepted snapshot item to resolve to a `ChecklistItem` (`docs/novo-ambient-loop-architecture.md:117`). Without a defined baseline rule, a first user-authorized import cannot establish the mapping, while an implementer could incorrectly treat an arbitrary webhook or delta as permission to create one.

   Distinguish the cases: a missing mapping from a webhook/delta remains quarantined; a first-seen entity from a verified, user-authorized bounded full/manual snapshot may establish the imported mapping only under an explicit bootstrap rule, inside the idempotency/projection transaction. That rule must be scoped to the selected account/project and must not infer completion, create a Novo `Task`, or alter a recommendation. All other missing/ambiguous mappings remain visible no-ops.

4. **[Medium] Specify the complete external identity tuple before describing the uniqueness invariant.**

   The planned observation carries `providerAccountRef` and `externalEntityType` (`docs/novo-ambient-loop-architecture.md:47-50`), but the entity-resolution and Todoist-slice language only says "per-user/provider" (`docs/novo-ambient-loop-architecture.md:86,115`). The future invariant must not silently collapse two accounts or entity classes that reuse an opaque provider ID.

   Define the required canonical identity in prose as at least **Novo owner + provider + owned provider account reference + external entity type + external entity ID**, or document and enforce a deliberate single-account-per-provider constraint. Apply the same rule when selecting the sole Calendar owner. This is an architecture requirement, not a request to add a model in this document.

## Verified strengths

- The document does not claim live OAuth scopes, deployed cron delivery, webhook subscription, provider E2E, or Preview proof (`docs/novo-ambient-loop-architecture.md:169-173`).
- `NovoSignalLedger`, `BehavioralSignal`, `McpAuditLog`, and `AiActivityRun` are not repurposed as a provider delivery journal; the global-Prisma transaction limitation of `upsertNovoSignals` is explicit (`docs/novo-ambient-loop-architecture.md:68-88`).
- The AUTO / CONFIRM / DO NOT CHANGE policy correctly prohibits inferred Todoist completion, recommendation/task mutation from checklist state, and calendar deletion from the present receiver (`docs/novo-ambient-loop-architecture.md:95-106`).
- MCP is correctly treated as an authenticated request transport sharing the future engine, while `record_recommendation_outcome` remains separate from `complete_task` and `start_task` (`docs/novo-ambient-loop-architecture.md:126-134`).

## Conclusion

After the four wording/contract corrections, this is a sound pre-implementation architecture boundary. It preserves the corrected audit's safety posture without claiming that the planned ambient loop exists today.
