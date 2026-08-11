# Novo ambient loop architecture

Date: 2026-08-11. Status: architecture boundary document, frozen from `docs/novo-continuous-reconciliation-audit.md`. This document describes what the repository proves today and the minimum interfaces required before an ambient loop can change Novo's recommendations. It does not authorize a schema, provider, transport, or product-behavior change.

## Decision

Novo has two deliberately separate loops:

| Loop | Purpose | Current proven entry points | May change external state? |
| --- | --- | --- | --- |
| Fast state-reconciliation loop | Make a bounded external fact agree with the correct Novo-owned representation, deduplicated and attributable. | Todoist pull: `app/api/integration/todoist/route.ts`; calendar pull: `app/api/integration/calendar/route.ts`; calendar receiver: `app/api/webhooks/calendar/route.ts`; periodic plugin path: `lib/inngest/functions/daily-insights.ts#runDailyInsights` -> `lib/plugins/plugin-orchestrator.ts#syncAllPlugins` -> `lib/plugins/todoist-plugin.ts#syncTodoistPlugin`. | **No autonomous external writes.** The fast loop may read from a user-authorized connection and project verified data into Novo; every Novo-to-provider write remains a **CONFIRM** action through a durable external-write boundary. Its maximum recommendation effect is safe stale-state invalidation. |
| Slow cognitive-learning loop | Turn verified Novo facts and explicit user outcomes into a bounded, explainable plan or recommendation. | `POST /api/cognitive/loop/plan`; `app/api/cognitive/loop/response/route.ts`; `app/api/cognitive/loop/signals/route.ts`; MCP `record_recommendation_outcome` in `app/api/mcp/route.ts`. | No autonomous external write. A calendar focus block remains a confirmed, separately idempotent action at `app/api/cognitive/loop/calendar/route.ts`. |

The fast loop is not a recommendation engine and the slow loop is not a provider delivery journal. Treating either as the other creates duplicate learning, stale Today state, or untraceable external side effects.

## Frozen current architecture

### What is real

- Todoist OAuth is implemented at `app/api/integration/todoist/connect/route.ts` and `app/api/integration/todoist/callback/route.ts`. `POST /api/integration/todoist` fetches selected-project active tasks through `lib/todoist.ts#todoistService.fetchAllTasks` and writes `ChecklistItem { source: 'todoist', sourceId }`.
- `IntegrationEngine.getTodayTasks` in `lib/integration-engine.ts` backs `GET /api/integration/today`; it aggregates reads only. It neither synchronizes nor recomputes a plan.
- `IntegrationEngine.syncCompletion` performs a local completion update and then best-effort calls `todoistService.closeTask` or `todoistService.reopenTask`. Its failure handling is logging, not a durable retry or compensation boundary.
- The periodic Todoist plugin is a real periodic-polling path: `runDailyInsights` calls `syncAllPlugins`, and `app/api/cron/daily-insights/route.ts` calls `maybeRunDailyInsights`; `vercel.json` declares a daily cron. Deployment and delivery of either scheduler are not proven. `syncTodoistPlugin` writes aggregate `BehavioralSignal` data, rather than matching a provider activity to a `ChecklistItem`.
- Calendar pull imports the next 30 days into `CalendarEvent` through `POST /api/integration/calendar`. Novo focus-block execution writes an idempotent `ExternalActionExecution` and then a `CalendarEvent` in `app/api/cognitive/loop/calendar/route.ts`.
- The calendar receiver exists, but is not a reliable reconciliation path: `app/api/webhooks/calendar/route.ts` reads a fixed -7/+30-day window and writes/deletes `TimeBlock`, not `CalendarEvent`. It has no proved watch registration, stored channel expiry, renewal, sync token, or `showDeleted: true` query.
- The recommendation-response protocol is real. `record_recommendation_outcome` validates a transition, uses `McpAuditLog` claiming/deduplication, updates `RecommendedAction`, idempotently writes `OutcomeEvent`, and completes its linked `Task` on `completed`. `tests/novo-loop-isolated.e2e.ts` covers that protocol in an isolated test environment.
- `AiActivityRun`/`AiActivityEvent` are the owned, ordered operational trace: `lib/ai/activity.ts#createActivityRun`, `appendActivityEvent`, and `finishActivityRun`; recovery behavior lives in `lib/ai/activity-contract.ts`.
- `NovoSignalLedger` is a user-scoped explainability/correction ledger, written through `lib/cognitive/signal-ledger.ts#upsertNovoSignals`. Its present input source union is only `checkin | goal | task | calendar | outcome`, and plan creation currently records/consumes check-in, goal, and Novo `Task` facts.

### What is not proven or is unsafe to reuse as-is

- No Todoist webhook receiver, registration, signature validation, delivery identity, cursor, or persisted watermark exists.
- Todoist REST task pull sees active tasks only (`lib/todoist.ts#mapTaskToIntegratedTask` fixes `completed: false`), so an absent task is not a locally reconciled completion or archive. `ChecklistItem` has no database uniqueness constraint on `(userId, source, sourceId)`.
- No imported Todoist completion drives `ActionPlan`/`RecommendedAction` recomputation. `POST /api/cognitive/loop/plan` does not consume imported `ChecklistItem` rows or calendar commitments.
- Calendar has competing external representations: pull writes `CalendarEvent`; the receiver writes `TimeBlock`. `TimeBlock.googleEventId` is globally unique, while `CalendarEvent.googleEventId` is optional and non-unique. Neither arrangement supplies a single per-user canonical mapping.
- `BehavioralSignal` lacks provider event identity and dedupe semantics; polling it as a delivery ledger would repeat aggregate observations. `NovoSignalLedger` fingerprints facts and overwrites the observed fact, so it is not an append-only external delivery journal.
- `upsertNovoSignals` uses the global Prisma client, not an injected transaction client; it cannot currently be placed unchanged inside a new reconciliation transaction.

## Canonical observation contract

The following is a **planned interface**, not a current model or API. It is the minimum normalized hand-off from a provider adapter to a reconciliation boundary. No consumer may infer a provider mutation from this record alone.

```ts
type CanonicalObservation = {
  observationId: string              // Novo durable delivery/reconciliation identity
  userId: string                     // authenticated owner; never provider-supplied alone
  provider: 'todoist' | 'google_calendar'
  connectionRef: string              // Novo-owned connected-account/integration reference
  providerAccountRef: string         // provider account selected by the owned connection
  externalEntityType: 'task' | 'calendar_event'
  sourceEntityId: string             // provider's stable object ID
  externalRevision?: string          // provider version/update marker, if supplied
  sourceEventId?: string             // provider event/activity identity, if supplied
  deliveryId?: string                // webhook/message delivery identity, if supplied
  observedAt: string                 // provider timestamp when trustworthy, else receive time
  fetchedAt: string                  // time the bounded pull/sync run fetched this observation
  receivedAt: string
  syncRunId?: string                 // identifies the serialized bounded snapshot run
  operation: 'upsert' | 'completed' | 'deleted' | 'snapshot'
  safeSummary: { title?: string; dueAt?: string; startAt?: string; endAt?: string; priority?: string }
  payloadFingerprint: string         // deterministic hash of the permitted normalized content
  source: 'webhook' | 'delta_pull' | 'full_pull' | 'manual_sync'
}
```

`safeSummary` intentionally excludes raw journal text, OAuth tokens, full provider payloads, and provider error bodies. Provider-specific payload retention, if ever needed, belongs behind an explicit privacy policy and a separate encrypted retention decision.

The planned projection identity is the complete tuple **Novo owner + provider + owned connection/provider-account reference + external entity type + source entity ID**. An observation/delivery identity additionally includes `sourceEventId` when available or `deliveryId` when that is the provider's supplied delivery identity. A source event or delivery ID identifies a receipt/replay candidate; it does not establish entity ordering. The future invariant must preserve this complete tuple (or deliberately enforce and document a single-account-per-provider constraint) so opaque IDs from separate accounts or entity classes cannot collide. The same rule applies when selecting the sole canonical Calendar owner.

### Mapping to current Novo surfaces

| Observation concern | Existing surface | Allowed role now | Not a substitute for |
| --- | --- | --- | --- |
| Provider delivery/reconciliation identity | None | None; this is a blocker. | A durable idempotency/cursor/retry record. |
| Explainable current fact | `NovoSignalLedger` via `upsertNovoSignals` | Correction/exclusion and explainability after a deduplicated reconciliation succeeds. | Delivery journal or transaction coordinator. |
| Learning-worthy transition | `BehavioralSignal` | Record only a first verified lifecycle transition, e.g. a reconciled completion; never every poll. | Provider event store or item identity map. |
| Recommendation outcome | `OutcomeEvent` linked to `RecommendedAction` | Explicit user/MCP response protocol. | External task completion inference. |
| Local imported Todoist task | `ChecklistItem { source: 'todoist', sourceId }` | Todoist object representation for Today/integration reads. | Novo `Task`, recommendation outcome, or uniqueness guarantee. |
| Local calendar commitment | `CalendarEvent { source, googleEventId }` **or** `TimeBlock { googleEventId }` | Existing competing representations. | A canonical calendar owner; one must be selected before ambient calendar reconciliation. |
| User-visible operation trace | `AiActivityRun` and `AiActivityEvent` | Ordered reconciliation status after the boundary has an owned run. | Provider delivery ledger. |
| MCP mutation audit | `McpAuditLog` | Claim/deduplicate MCP-initiated mutations only. | Provider webhook/poll idempotency. |
| Actual cognitive work item | `Task` | Existing planner input and linked recommendation execution. | An imported `ChecklistItem` unless an explicit, verified mapping is introduced. |
| Proposed/accepted next action | `RecommendedAction` | Slow-loop recommendation and explicit response state. | Automatic reaction to a provider event. |

## Reconciliation boundary: required tiers

The boundary must process each normalized observation in this order. Every tier is required before an observation can become a learning signal or trigger recommendation invalidation.

1. **Ownership and authorization.** Resolve the integration account by an authenticated Novo `userId` and provider account reference. Verify the connection and scope on the server; do not derive owner from event metadata, expose tokens, or accept an unbound provider identifier.
2. **Authentication and delivery verification.** Verify webhook signature/channel token where the provider supplies one; authenticate pull using the owned server-side credential. Reject malformed, expired, unbound, or unverifiable input before entity lookup.
3. **Idempotency and ordering.** Claim a durable record keyed by the complete projection identity plus a source event/delivery ID or provider revision, with a payload fingerprint fallback for an identical full-pull result. Persist cursor/watermark advancement only after the corresponding local transaction succeeds. A delivery ID deduplicates delivery but does not establish event order. Use ordering only when the provider documents an entity- or account-scoped monotonic revision/delta sequence. When that guarantee is absent, serialize and identify the full/manual sync run (`syncRunId`), treat its response as an authoritative bounded snapshot only within that run, and never use `receivedAt` as an ordering surrogate. Compare provider `observedAt` event timestamps and the run's `fetchedAt` only as documented provider evidence; a tie, overlap, missing comparison basis, or out-of-order observation is quarantined/left unchanged rather than projected. Duplicate and provably older observations are no-ops with an auditable result.
4. **Entity resolution and bootstrap.** Resolve exactly one local entity by the complete projection identity. A collision, ambiguous account, cross-user candidate, or a missing mapping from a webhook/delta is a quarantined/visible no-op, not an automatic create/update/delete. The sole exception is an explicit bootstrap rule: a first-seen entity from a verified, user-authorized, bounded full/manual snapshot may establish the imported mapping inside the same idempotency/projection transaction. Bootstrap is limited to the selected connection/account and Todoist projects (or the explicitly selected Calendar scope), records a baseline watermark/run identity, and must not infer completion, emit learning from baseline state, create a Novo `Task`, or alter a recommendation. All other missing mappings remain visible no-ops.
5. **Atomic state projection.** In one transaction, update the canonical local entity, write the reconciliation outcome, and create/update the safe explainability fact. The current `upsertNovoSignals` is not transaction-safe for this use; a transaction-aware helper or equivalent direct transactional write is required.
6. **Derived learning and UI trace.** Emit one `BehavioralSignal` only after a verified, deduplicated lifecycle transition. Create `AiActivityRun`/`AiActivityEvent` status from the completed outcome. Do not make repeated polls look like repeated behavior.
7. **Recommendation disposition.** Recompute only if slow-loop prerequisites and policy gates hold; otherwise invalidate/mark stale the relevant read model and wait for an explicit plan request. `GET /api/integration/today` stays a read endpoint, not a recomputation hook.

## Policy: AUTO, CONFIRM, DO NOT CHANGE

These are architecture rules for the future boundary; they do not assert an existing automatic policy engine.

| Class | Allowed action | Examples | Required gates |
| --- | --- | --- | --- |
| **AUTO** | Internal, reversible state reconciliation and bounded operational status. | Deduplicate a verified delivery; update the selected canonical imported entity; store a safe current fact; mark a stale recommendation read model; show a reconciliation activity event. | Connected owner; verified source; idempotency claim; unambiguous entity map; transaction success; least-privilege data handling. |
| **CONFIRM** | A user-visible or external side effect, or any adaptation that changes a commitment. | Create/move/delete a calendar focus block; complete/reopen an external Todoist task from Novo; accept/modify/postpone a recommendation; add an imported task to a Novo plan; send notification/message. | Explicit user intent, current provider scope, idempotency key/outbox/retry outcome where external write occurs, clear preview/explanation, and an owned audit trail. |
| **DO NOT CHANGE** | Any action based on incomplete, ambiguous, stale, repeated, or unverified evidence. | Infer a Todoist completion because a task disappeared from an active-only pull; close a `Task`/`RecommendedAction` from a checklist event; erase calendar state from the current receiver; re-learn an aggregate plugin count; silently widen data collection. | Stop/quarantine and surface a bounded safe error or stale state. No retry loop may turn this into a mutation without new verified evidence. |

### Privacy, proactivity, and threshold gates

- **Privacy gate:** normalize only the fields necessary to reconcile and explain the action; do not log tokens, raw private journal text, raw provider errors, or full provider payloads to client-visible activity. Respect the connected account, selected Todoist projects, and OAuth scopes.
- **Proactivity gate:** an ambient observation may refresh an internal fact or invalidate stale advice; it may not become a new user-facing recommendation or external action solely because it arrived in the background. The existing product boundary is explicit plan generation plus user response.
- **Threshold gate:** pure helpers such as `lib/cognitive/todoist-signal.ts#evaluateTodoistThresholds` and `lib/cognitive/calendar-signal.ts#evaluateCalendarThresholds` can describe a bounded condition from already-synced data. A threshold is neither delivery verification nor authorization to mutate; it must be based on current canonical, owned, deduplicated state and pass the proactivity gate.
- **Confidence/freshness gate:** never replace a manually confirmed decision with an inferred provider state. Low confidence, missing revisions, stale watermarks, or an unresolved conflict must remain explanatory/visible only.

## Todoist-first vertical slice

Todoist is the first viable slice because the repository already has an OAuth connection, selected-project pull, `ChecklistItem` projection, Todoist threshold helpers, Today integration reads, and a periodic polling hook. It is not yet a completion-reconciliation slice.

### Slice boundary

1. Add a durable, per-user/provider reconciliation identity and cursor/delivery state (planned; no current model supplies it).
2. Make the chosen Todoist external mapping unique by the complete projection identity: Novo owner + Todoist provider + owned connection/account + `task` entity type + `ChecklistItem.sourceId`. `ChecklistItem.sourceId` is the existing candidate, but its current index is insufficient.
3. Start with a bounded, verified, user-authorized pull of selected projects. Project selection remains the privacy boundary. The first successful run is an explicit bootstrap: create only the missing imported `ChecklistItem` mappings for that selected scope inside the idempotency/projection transaction, record a baseline watermark/run identity, and treat all rows as baseline state. It must not infer completion from absence, create a Novo `Task`, alter a recommendation, or emit behavioral learning merely because an item first appeared.
4. After bootstrap, normalize each accepted provider item as `CanonicalObservation`, claim idempotency, resolve its owned `ChecklistItem`, and atomically project active changes. A missing mapping from a webhook/delta or an ambiguous/out-of-scope item remains a visible quarantined no-op. Record a safe ledger fact only after the projection succeeds.
5. For an explicit provider completion event or completion-capable delta, update exactly the mapped `ChecklistItem`, emit one lifecycle `BehavioralSignal`, and create reconciliation activity. Do not complete a Novo `Task`, `RecommendedAction`, or `OutcomeEvent` by inference.
6. Mark Today/recommendation context stale. Only the existing explicit `POST /api/cognitive/loop/plan` path may create a new plan until the planner is deliberately expanded to consume the reconciled imported facts.
7. Later, add webhook support only after signature verification, subscription lifecycle, delivery identity, replay handling, and retry/outbox behavior are present. A webhook must feed the same normalization and reconciliation engine as pull.

### Definition of done for the slice

Tests must cover duplicate and out-of-order deliveries, cross-user IDs, repeated full pulls, partial failures before/after projection, cursor advancement, explicit completion mapping, correction/exclusion behavior, activity ordering, and stale-plan disposition. They must also prove that no external completion silently changes a Novo `Task`, `RecommendedAction`, or provider resource. The existing isolated MCP outcome test is useful protocol evidence, but it is not a Todoist E2E or deployed Preview proof.

## MCP routes through the same engine

MCP is another authenticated request transport, not a second reconciliation model. `app/api/mcp/route.ts` already creates an authenticated `McpServer`, applies `prepareMcpRequest` and `validateMcpBearerToken`, rate limits, and uses `claimMcpMutation`/`finishMcpAudit` for mutation auditing.

For future ambient capabilities:

- An MCP tool that requests a provider refresh must call the same adapter -> `CanonicalObservation` -> tiered reconciliation engine as cron, webhook, and UI manual sync. It may return a safe summary and activity reference, never bypass ownership or dedupe.
- MCP `record_recommendation_outcome` remains the canonical explicit recommendation-response path. `complete_task` and `start_task` must not be treated as recommendation outcomes until an explicit verified relation is introduced.
- MCP-originated provider writes remain **CONFIRM** actions, use the same durable external-write/idempotency boundary, and retain `McpAuditLog` as audit metadata rather than repurposing it as provider delivery storage.

## Calendar contextual limits

Calendar can provide context for a plan, but it cannot yet be the ambient canonical source:

- The pull path and webhook path write different models (`CalendarEvent` and `TimeBlock`). Select one owner and per-user external-ID invariant before using provider changes for cognition.
- A receiver does not prove a watch. The repository has no `calendar.events.watch`/`channels.watch` registration, persisted channel resource ID/expiry, or renewal lifecycle.
- The current receiver's fixed time window, absence of a sync token and `showDeleted: true`, and conflicting representation mean cancellation/deletion evidence is unreliable. It must not remove advice or schedule automatically.
- `app/api/cognitive/loop/calendar/route.ts` is a separate, confirmed focus-block execution path with `ExternalActionExecution` idempotency and scope checks. Keep it separate from observation/reconciliation until a common external-write boundary is designed.

## Background transport limits

| Transport | Current evidence | Limit |
| --- | --- | --- |
| UI/manual pull | Todoist and calendar integration routes | Full/specified-window fetches; no cursor/delivery ledger; only the Todoist import has selected-project scope. |
| Daily cron / Inngest | `vercel.json`, `app/api/cron/daily-insights/route.ts`, `runDailyInsights`, `maybeRunDailyInsights` | Source/config proves a periodic code path only. Deployed schedule, delivery, retry, and provider correctness are unproven. |
| MCP | `app/api/mcp/route.ts` transport, auth, rate limits, audit | A request path, not a background queue or provider reconciliation guarantee. |
| Calendar webhook receiver | `app/api/webhooks/calendar/route.ts` | Receiver is incomplete without watch lifecycle, durable delivery identity, deletion-correct delta sync, and canonical calendar projection. |
| Todoist webhook | None found | Not available. |

No background transport may advance a cursor before atomic projection, trigger unbounded fan-out, expose raw provider errors, or cause a user-facing/external side effect without the policy gates above. A scheduler retry is not idempotency; retries must be safe at the observation and projection boundary.

## Explicit blockers before ambient recommendations

1. Durable provider delivery/cursor/idempotency/retry state does not exist.
2. Todoist completion cannot be reconciled from the active-task pull; no completion delta/webhook mapping exists.
3. The Todoist `(userId, source, sourceId)` identity is not database-enforced.
4. Calendar has no single canonical local entity or per-user external-ID invariant.
5. Google watch creation, stored metadata, renewal, sync token, and deletion-correct handling are absent.
6. The signal-ledger source vocabulary and planner inputs exclude provider-origin facts; `upsertNovoSignals` is not transaction-injectable.
7. The current planner consumes Novo `Task`, not imported `ChecklistItem` or canonical calendar commitments.
8. Completion write-back has no durable outbox, retry, compensation, or reconciliation result.
9. There are no route-level tests for Todoist completion reconciliation, duplicate/out-of-order provider delivery, calendar watch lifecycle, or external-change-to-plan behavior.

Until all applicable blockers are resolved, ambient integration work is constrained to read/sync visibility and internal stale-state signaling. It must not claim real-time reconciliation, external E2E coverage, Preview validation, automatic plan changes, or autonomous external actions.

## Evidence boundary

This architecture relies on repository inspection and the tests named above. It does not establish live OAuth scopes, provider configuration, cron/queue deployment, webhook subscriptions, real Todoist/Google delivery, external end-to-end behavior, or Preview behavior.

## Correction report — 2026-08-11

Applied the architecture review's four required clarifications without changing code, schema, migrations, provider configuration, or external state:

1. A connected provider now authorizes reads/projection only; every Novo-to-provider write is explicitly a **CONFIRM** action through a durable external-write boundary.
2. The contract and tier 3 now distinguish delivery deduplication from ordering, prohibit `receivedAt` as an ordering surrogate, and define serialized bounded snapshots plus quarantine for ties, overlaps, and indeterminate/out-of-order observations.
3. Tier 4 and the Todoist vertical slice now define a first-import bootstrap rule with selected-scope baseline watermarking and prohibit baseline completion inference, learning, Novo task creation, and recommendation changes. Missing webhook/delta mappings remain quarantined.
4. The contract now states the full projection identity and the distinct observation/delivery identity, including owner, provider, owned connection/account, entity type, source entity ID, and source event/delivery ID.
