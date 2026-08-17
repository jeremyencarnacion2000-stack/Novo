# NOVO — Ambient Semantic Target Checkpoint

Date: 2026-08-11  
Scope: read-only audit before enabling the Todoist Ambient runner.

## Verdict

**FAIL — runner remains blocked.** `RecommendedAction` is the correct cognitive
execution entity for Novo's user-facing lifecycle, but it is not yet a safe
durable external target because ordinary plan generation supersedes the active
`ActionPlan` and creates a new `RecommendedAction` record. No mapping policy
currently preserves or migrates that relationship.

## Acceptance matrix

| Criterion | Result | Evidence |
|---|---|---|
| Ownership | PASS | `RecommendedAction.userId`; response route always queries `{id, userId}`. |
| Stable persisted identity | PASS | `RecommendedAction.id` is a persisted cuid; reload-safe. |
| Survives re-plan | **FAIL** | `app/api/cognitive/loop/plan/route.ts:127-151` marks active plans `superseded` and creates a fresh action every run. No identity reuse or external mapping migration. |
| Completion lifecycle | PASS (internal) | `lib/cognitive/action-state-machine.ts` permits accepted/started → completed and rejects contradictory terminal transitions. |
| OutcomeEvent | PASS (internal) | `app/api/cognitive/loop/response/route.ts:68-85` updates the action and creates one `OutcomeEvent`. |
| Activity | PASS (internal) | Same route records `novo_loop` ActivityRun/events through `recordOutcomeActivity`. |
| Recommendation recalculation | PASS (normal path) | Plan generation reads recent outcomes and unfinished tasks, supersedes the active plan, and chooses a new recommendation. External translation is not wired. |
| Today | FAIL / unproven | No Todoist-independent contract evidence that Today consumes `RecommendedAction` terminal state; no certified replay. |
| Chat | FAIL / unproven | No contract evidence that fresh chat context excludes a completed action and exposes its persisted outcome. |
| Cognitive | PASS (projection path) | `lib/cognitive-graph/projection.ts` reads actions/outcomes and links `recommendation:<id>` to `outcome:<id>`; adaptation tests pass. |
| Idempotency | PASS (internal API) | Unique `OutcomeEvent.idempotencyKey`, preflight and P2002 race recovery. External duplicate-observation path is not yet connected. |
| External mapping suitability | **FAIL** | Re-plan identity instability makes a Todoist mapping to an action unsafe without explicit policy. |

## Re-plan identity test

The route's transaction executes:

```text
active ActionPlan → status=superseded
new ActionPlan + new RecommendedAction (nested create)
```

The old action is retained for history, but the new logical recommendation has
a different ID. Therefore the result is **C: historical record retained,
new active action created**. The external mapping must either remain attached
to the historical action with an explicit no-forwarding policy, or be migrated
only by a deliberate, auditable identity rule. No such rule exists today.

## State edge policy currently available

The canonical internal response route supports `proposed → accepted`, then
`accepted/started → completed`; `completed`, `dismissed`, and other terminal
states are protected by the state machine. It does **not** define an external
completion translation for `proposed`, nor a safe policy for externally
completing dismissed/abandoned/failed actions. Those policies are prerequisites
for a runner and must reuse this route/service rather than mutating status.

## Evidence

- `npx jest lib/cognitive/__tests__/action-state-machine.test.ts lib/cognitive-graph/__tests__/projection-adaptation.test.ts --runInBand`
  — **2 suites / 4 tests PASS**.
- `prisma/schema.prisma` — persisted `RecommendedAction`, `OutcomeEvent`, and
  `ActionPlan` relations inspected.
- `app/api/cognitive/loop/response/route.ts` — ownership, transition,
  idempotency, outcome, and Activity path inspected.
- `app/api/cognitive/loop/plan/route.ts` — re-plan transaction inspected.

## Required before runner authorization

1. Decide and implement an explicit identity policy for mappings when a plan is
   superseded (prefer an existing durable action identity; do not invent a new
   Ambient entity without proving necessity).
2. Define external completion translation for every action state, including
   terminal and correction/rejection cases.
3. Add contract tests proving Today, Chat, and Cognitive consume the canonical
   completion without Todoist-specific branches.
4. Prove duplicate external observations produce one outcome/activity/planning
   consequence through durable persistence.

**TODOIST RUNNER: STILL BLOCKED**  
**GLOBAL RELEASE: NOT PASS**
