# Ambient Durable Work Identity Audit

Date: 2026-08-11  
Scope: certify the existing `Task` model before authorizing the Ambient runner. No runner, cron, or production deployment was started.

## Finding

`Task` is the only existing product entity that represents logical work independently of a recommendation instance. Its ID is generated once and the planner reads the same persisted task on every plan generation. However, the recommendation bridge is only a nullable string (`RecommendedAction.taskId`) with no Prisma relation or foreign key, and the canonical cognitive completion path is still recommendation-centric. Therefore the durable identity is **partially proven, not certified**.

## Evidence

- `Task` has an owned, persisted `id`, `userId`, status, project relation, timestamps, and user/status indexes (`prisma/schema.prisma`).
- `POST /api/cognitive/loop/plan` selects existing unfinished tasks and persists `recommendation.taskId` into each newly-created `RecommendedAction`; it supersedes the prior plan but does not recreate the task.
- `choosePrimaryRecommendation` filters `status !== 'done'`, so a completed task is excluded from subsequent plans.
- `POST /api/cognitive/loop/response` can create a task for a task-less recommendation, updates the recommendation and task in one transaction, and creates an `OutcomeEvent` keyed by idempotency key.
- `PUT /api/tasks/[id]` updates Task status with ownership checks, but a direct `done` transition only emits a generic twin signal; it does not create an `OutcomeEvent`, Activity completion, or trigger a re-plan.
- `OutcomeEvent` references `RecommendedAction` (optional) and has no `taskId`; logical work is therefore not durable in outcome records.
- Activity emitted by the response route is an activity-run narrative, not a durable Task completion event. No Task relation is present.
- Todoist linking tests and API currently target `ChecklistItem`; the Ambient mapping target has not been switched to `Task`.

## Required matrix

| Requirement | Result | Reason |
|---|---|---|
| Task ownership | PASS | All inspected APIs scope by `userId`; Task has required User relation. |
| Stable persisted ID | PASS | CUID primary key is stored on Task and reused by planner reads. |
| Survives reload | PASS (schema) | Persistent PostgreSQL model; runtime DB replay still external-blocked. |
| Survives re-plan | PASS (code path) | Re-plan supersedes ActionPlan rows, while selecting existing Task rows and copying the same ID. No isolated DB replay proof yet. |
| Represents logical work | PASS | Title/status/project belong to Task, not recommendation context. |
| Completion semantics | PARTIAL | Task status can become `done`, but direct Task completion bypasses cognitive outcome lifecycle. |
| RecommendedAction relationship | PARTIAL | `taskId` is written/read, but no FK/relation/index or resolver for current recommendation exists. |
| Outcome semantics | INDIRECT | OutcomeEvent can reference a recommendation that carries a taskId; it cannot reference Task directly. |
| Planning consequence | PASS | Planner only supplies `todo`/`in-progress` tasks and decision rules reject `done`. |
| External mapping suitability | FAIL | Existing Todoist mapping is still `ChecklistItem`; Task adapter/route is not wired. |

## Critical gaps before runner authorization

1. Add the smallest explicit nullable `RecommendedAction.task` relation (or document an equivalent deterministic bridge) and a current-recommendation resolver.
2. Define a canonical durable-work completion service that updates Task, resolves the current recommendation without trusting a stale recommendation ID, creates exactly one logical OutcomeEvent and Activity, and triggers normal re-planning.
3. Add durable Task linkage to OutcomeEvent if required for replay/audit; recommendation-only linkage is not sufficient for external completion.
4. Move Ambient Todoist mappings from `ChecklistItem` to `Task`; keep legacy checklist synchronization separate and deduplicated.
5. Prove idempotency and the re-plan/completion race against a disposable PostgreSQL database.

## Verdict

**Canonical durable target: Task (candidate, not certified).**

The architecture is directionally correct: recommendations are replaceable projections and Task is stable work identity. The Ambient runner remains **STILL BLOCKED** until the bridge and canonical completion lifecycle are implemented and independently tested.
# Canonical re-plan closure

Durable completion is followed by the same canonical planner boundary used by
`POST /api/cognitive/loop/plan`. The provider-agnostic coordinator
`completeDurableTaskAndReplan` injects that planner, retries transient failures,
and reports `replanPending: true` until a plan is actually returned. Completion
is never rolled back when planning is unavailable.

The deterministic proof is: Task A is completed, the planner re-reads eligible
tasks through its normal boundary, excludes A (`status = done`), and persists a
recommendation for Task B. Today, Chat, and Cognitive consume the resulting
active plan; this unit proof does not claim authenticated UI propagation or
external-provider delivery, which remain integration/Preview evidence gates.

