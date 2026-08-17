# Novo system validation

## Product-truth milestone addendum — 2026-08-04

The new product audit is recorded in `docs/novo-product-truth.md`. The repository proves a technical closed-loop kernel, but it does not prove market activation, sub-60-second first value, paid conversion, PMF or a complete canonical funnel. The current onboarding remains a five-question profile flow (`app/onboarding/page.tsx`), so its performance against the new wedge is classified as incomplete rather than complete. The six milestone documents now separate code evidence from founder-owned validation work.

The existing Loop analytics (`lib/cognitive/events.ts`) are persisted and sanitized, but canonical activation/payment event coverage is not yet guaranteed at every UI boundary. No conversion, retention, interview or payment result is inferred from code.

## UI cleanup addendum — 2026-08-04

The navigation audit and information architecture are documented in `docs/novo-ui-cleanup-audit.md` and `docs/novo-information-architecture.md`. Primary navigation now points to Today, Cognitive, Chat and the existing Activity anchor; Workspace and More hold secondary/legacy routes. No routes or data were deleted. The Impeccable detector returned no findings for the changed navigation/activity files; targeted lint, strict TypeScript and full Jest remain green (61 suites / 198 tests / 2 snapshots).

This session added the server-owned `POST /api/onboarding/start` event and `first_plan_generated` emission. Lint, strict TypeScript and the full Jest suite pass after the change. A production build attempt exceeded the command time limit and a second attempt was prevented by the active `.next/lock`; this is recorded as a validation blocker, not as a build pass.

The isolated database guard still passes for `novo-e2e-test` with `productionOverlap=false`. A fresh isolated E2E rerun in this session passed 5/5 tests in 91.2 seconds, including adaptation, ownership, duplicate/out-of-order delivery, MCP idempotency and Calendar idempotency. The build was then run from a clean `.next`: it compiled in 7.3 minutes but exited 134 on the default Node heap; a retry with 4 GB heap remained active beyond 10 minutes. The exact orphaned tree was identified and closed (`npm run build` → `next build --webpack` → worker); only the unrelated Codex MCP server remains. `.next/lock` is absent after cleanup. This session does not claim a production build pass.

## Latest evidence addendum — 2026-08-04

- Full Jest now passes 61/61 suites, 198/198 tests and 2 snapshots. The latest test covers the interactive Cognitive Center path: switching to Objetivos, selecting a signal, reading its inspector evidence, and submitting signal exclusion through the owned API route.
- The previous production deployment remains the current alias target: `novo-desktop-i54g6tgzq.vercel.app` → `productivitynovo.vercel.app`. Runtime code was unchanged after that deployment; the latest change is test-only.
- The isolated database E2E remains 5/5 with no open-handle diagnostic. Strict TypeScript, lint (0 errors; six inherited warnings) and `git diff --check` remain green.
- The authenticated browser evidence gap is intentionally unchanged: local client hydration was not stable enough to claim a full visual inspector/lens run. The route has bounded timeout/retry behavior and the interaction is now covered by a deterministic component test.
- The mobile inspector is now implemented with the shared drag-to-dismiss Sheet primitive and mirrors the desktop evidence/actions surface; lens changes are URL-addressable (`?lens=now|goals|patterns|memory|sources`). Deployment `novo-desktop-qxqsd3nj6.vercel.app` was aliased to `productivitynovo.vercel.app` and the generic review-agent canary returned HTTP 200 for all public review routes.
- The final hydration-safe build is `novo-desktop-dwg4k5aga.vercel.app`, aliased to `productivitynovo.vercel.app`; it generated 127/127 routes. Generic review-agent checks returned HTTP 200 for `/landing`, `/cognitive`, and `/robots.txt`.
- Focus-mode wiring was included in the final build `novo-desktop-1xl8rkqtt.vercel.app`, aliased to `productivitynovo.vercel.app`: repeated node selection requests the existing bounded `focus` projection, and Escape clears it without a second graph implementation.

## 2026-08-02 - Live deployment and real MCP task proof

The linked Vercel project deployed successfully with the current build, SSO protection was disabled for public review, and the deployment was aliased to `productivitynovo.vercel.app`. Direct HTTP checks returned 200 for `/`, `/landing`, `/robots.txt`, `/terms`, `/privacy`, and `/refunds`; `/landing` returned meaningful server-rendered HTML and crawlable auth/policy links. The root did not redirect. The gstack browser daemon crashed twice, so visual screenshot/console evidence is explicitly missing even though HTTP behavior is green.

A generic automated-reviewer user agent also received HTTP 200 and server-rendered product/pricing HTML from `/landing`; this transport check does not claim browser-console cleanliness.

Real MCP proof now exists in production: initialization and `get_pending_tasks` both returned HTTP 200; four actual checklist resources were read; three were marked complete via `update_checklist_item` with separate idempotency keys; a subsequent read persisted exactly one remaining Bklit task. The API implementation and isolated E2E provide the corresponding ownership, audit, scope, revocation, expiration, and idempotency evidence. No MCP token was written to logs or documentation.

Unauthenticated `GET /api/mcp` on the public alias returns `401 Unauthorized`; MCP remains protected while `/landing` is public.

## 2026-08-02 - MCP audit coverage and sync idempotency

The MCP surface no longer leaves routine/resource reads outside `McpAuditLog`. It also requires idempotency for `trigger_plugin_sync`, claims before dispatch, safely finishes success/failure records, and returns the original result for duplicate keys. `tests/novo-loop-isolated.e2e.ts` verifies the tool schema advertises `idempotencyKey` and the full 5-test isolated suite remains green. This closes an audit/idempotency gap without adding a new capability.

Post-change production evidence is green: lint 0 errors / 6 inherited warnings, Jest 56 suites / 181 tests / 2 snapshots, strict TypeScript PASS, isolated migration PASS with no pending migrations, isolated E2E 5/5, Next production build PASS with 127/127 generated routes, and the current build is live at `productivitynovo.vercel.app`.

## Current completion score (2026-08-02 evidence refresh)

| Category | Score | Evidence / remaining limitation |
|---|---:|---|
| Observation | 4/5 | Persisted objectives, check-ins, tasks, signals and outcomes; external calendar input remains permission-dependent. |
| Interpretation | 4/5 | Deterministic decision rules and provenance ledger; legacy compatibility terminology remains in old surfaces. |
| Prioritization | 4/5 | Bounded ranking adapts to outcomes and exclusions; no universal confidence calibration yet. |
| Intervention | 5/5 | Facts/inference/recommendation separation and all user transitions are implemented and E2E-covered. |
| Execution | 4/5 | Internal actions and confirmed Calendar boundary work; provider credentials are intentionally not exercised in isolated E2E. |
| Verification | 5/5 | Completion, failure, postponement, abandonment and feedback persist and are tested. |
| Learning | 4/5 | Prior outcomes change the next plan ranking/decomposition; broader preference learning remains incremental. |
| Explainability | 4/5 | “Why this?” facts, interpretation, confidence and signal correction exist; authenticated visual runtime capture is missing. |
| User control | 4/5 | Accept/modify/postpone/dismiss/intrusive and signal exclusion are available; external writes require confirmation. |
| Persistence | 5/5 | Isolated migration and 5-flow E2E prove owner-scoped persistence and recovery. |
| Security | 4/5 | Hashed/revocable scoped tokens, ownership, payload cap, rate limits and sanitized audit; in-memory rate limits are process-local. |
| Reliability | 4/5 | SSE recovery/polling/cancel/error paths pass tests; Jest delayed-exit cleanup warning remains. |
| AI activity truthfulness | 4/5 | Server-originated ordered activity events with no chain-of-thought; provider-specific long-run behavior needs more production telemetry. |
| Visual quality | 3/5 | Build/live HTML are healthy; gstack browser crashed twice, so no fresh visual screenshot. |
| Accessibility | 3/5 | Reduced-motion/ARIA/keyboard code and tests exist; no fresh production screen-reader session. |
| Mobile experience | 3/5 | Responsive code and mobile states exist; no fresh production viewport capture. |
| Performance | 3/5 | Production build and bounded queries pass; no live browser timing trace because the browser daemon failed. |
| Test coverage | 5/5 | 56 suites / 181 tests, 5/5 isolated E2E, 2 snapshots, zero failures. |
| Observability | 4/5 | Run/tool/retry/MCP audit events are persisted without secrets; delayed runner cleanup remains. |
| Production readiness | 4/5 | Deployed and HTTP-canary verified; visual browser canary and one unresolved Bklit compatibility task remain. |

## 2026-08-02 - Current isolated database and package evidence

The migration lock cleared. With the guarded `DATABASE_URL_TEST` only, `npm run db:migrate:test` passed and reported no pending migrations. The subsequent isolated E2E passed 1 suite / 5 tests in 54.5 seconds; the runner's delayed-exit notice is cleanup debt after a green suite. No production connection was used.

The requested “bklit UI” lookup resolves on npm to `bklit-vue-charts@0.1.0-beta.4`, a Vue 3 port whose peer dependencies are `vue`, `motion-v`, and `@vueuse/core`. Because Novo is React/Next, installing it would not make the existing charts usable and would add an unreferenced framework. It remains intentionally uninstalled pending a React-compatible release or an explicit package reference.

## 2026-08-02 - Gate rerun and isolated migration lock evidence

`npx prisma validate` passed and the isolation guard accepted the dedicated `novo-e2e-test` branch (`productionOverlap=false`). `prisma migrate deploy`, run only through `DATABASE_URL_TEST`, timed out twice waiting for Prisma's PostgreSQL advisory migration lock (`P1002`). Read-only lock inspection found a separate active migration-lock holder on the isolated database. This was not bypassed and no session, schema, data, or production connection was altered. It is an external test-environment gate, not evidence that migrations failed to compile.

The rest of the current evidence is green: lint 0 errors / 6 inherited warnings; strict TypeScript PASS; 56 Jest suites / 181 tests PASS; and the isolated E2E PASSes 5/5 for the persisted closed loop, ownership, retry telemetry, ordering/duplicate recovery, signal exclusion, MCP scopes/audits/idempotency, and concurrent Calendar idempotency. The isolated Jest runner reports a delayed-exit warning after success. Production build and deployment remain pending, so the system is not yet production-complete.

The production build was subsequently run without any database mutation and passed. `next build --webpack` compiled, type-checked and generated 127/127 routes. Its only notices were baseline browser-mapping freshness and the Next middleware-to-proxy deprecation. This is build evidence only; it does not bypass the outstanding test-database migration lock or permit deployment.

## 2026-08-02 - Metric audit: removed stale burnout-derived visualizations

Historical Twin records may contain legacy `burnoutIndex` data from earlier heuristics. It is now excluded from the graph and from metrics-history output rather than being rendered as a user measure or inverted into a “recovery reserve.” The remaining numeric workload signal is labelled a non-biometric operational estimate. The settings surface no longer shows overload or decision-fatigue pills sourced from legacy metrics. `lib/__tests__/cognitive-graph.test.ts` proves an input with `burnoutIndex: 93` produces neither a burnout node nor edge; focused lint and strict TypeScript pass. This reduces active misleading presentation but does not claim every compatibility type or historical field has been deleted.

## 2026-08-02 - Activity retry observability evidence

The client recovery surface now records a sanitized retry event when a user explicitly reconnects. The event is sent to `POST /api/ai/activity/runs/[runId]` as the closed `telemetry/retry` enum and the route ownership-checks the run before persisting `{ runId }` through `trackNovoLoopEvent`. It does not include response text, prompts, tools or private content. Focused UI tests cover polling fallback, retry emission and out-of-order recovery timeline behavior (3/3 PASS). This closes the previously documented manual-retry instrumentation gap; browser-session telemetry still requires authenticated runtime evidence before a production-complete claim.

`tests/novo-loop-isolated.e2e.ts` now also proves the server boundary: user B receives 404 when attempting retry telemetry for user A's run; user A receives 200 and exactly one persisted `ai_run_retry` analytics event whose data contains only the run reference. The current safe database gate accepted `novo-e2e-test` with `productionOverlap=false`; the full isolated suite passed 5/5 in 57.4 seconds. Jest's delayed-exit notice followed the successful suite and remains test-runner cleanup debt, not a failure.

## 2026-08-02 - Current checklist implementation evidence

- Calendar execution in `components/cognitive/novo-loop-card.tsx` has a separate, visible confirmation step before `POST /api/cognitive/loop/calendar`. The focused UI test proves no request is emitted merely by opening the scheduling control.
- Wallpaper rendering is corrected in `app/globals.css`: `body.has-bg-image` no longer retains the opaque body color that could occlude its fixed negative wallpaper layers on desktop Chromium. `app/globals.test.ts` asserts the required transparent override and layer contract.
- Standard `Card` surfaces had a real settings disconnect: `glass-surface` and `card--secondary` used fixed/sidebar blur values rather than the user-controlled card blur. They now use `--card-blur-px`; primary/secondary/hero tiers retain a bounded visual hierarchy. CSS tests cover the exact declarations.
- `docs/video-demo-saas-explainer.md` supplies the requested demo script and privacy-safe capture plan. It is a documentation deliverable, not an automated video production system.
- Validation after these changes: lint has 0 errors (6 inherited warnings); Jest has 55 passing suites / 180 tests / 2 snapshots; strict TypeScript passes. Browser-level visual capture is still uncollected because the local gstack browser binary is not set up. No conclusion about production deployment is made from these local checks.
- Production build after the changes passed (`next build --webpack`): optimized compilation, strict TypeScript and 127/127 pages. Its only notices are the existing baseline-data freshness and deprecated middleware-convention warnings.

## 2026-08-02 — Suppression of synthetic fatigue in the legacy engine

- `lib/cognitive-engine.ts` no longer emits `SYNAPTIC_FATIGUE` or `REDUCED_CAPACITY_MODE` from clock time, a circadian curve, internal task costs, or stress values. Those inputs can only inform an operational planning preference; they do not establish mental energy, fatigue, or capacity.
- Compatibility types and the presentation normalizer remain for old installs, but the normal flow no longer creates a fatigue alert, navigation block, or automatic ambient audio. `tests/cognitive-engine.test.ts` and `lib/cognitive/__tests__/presentation-state.test.ts` pass 8/8.
- `components/settings/settings-twin.tsx` labels its telemetry as operational estimates, explicitly states that it is not medical or biometric measurement, and adapts that copy for `en`, `es`, `fr`, and `de`. Focused lint passes. Legacy surfaces outside the Loop remain under audit.

## 2026-08-02 — Latest isolated MCP evidence

The current `npm run test:db:guard` accepted only `novo-e2e-test` with `productionOverlap=false`. The immediately following isolated E2E run passed all 5 flows in 50.8 seconds. It exercises persisted MCP ownership, scopes, hashed/revocable/expired tokens, idempotent task/checklist/recommendation mutation, sanitized audit records, and the full Loop feedback adaptation path. This is isolated-database evidence, not a production credential claim. Jest emitted its generic delayed-close warning after the successful run; the suite itself had zero failures.

## 2026-08-02 — Objective-flow correction

The Loop form now forwards the newly persisted objective identifier to `POST /api/cognitive/loop/plan`. This fixes a real UI-to-persistence disconnect: previously a user-created objective could be ignored in favor of a different latest active objective. `components/cognitive/__tests__/novo-loop-card.test.tsx` proves the plan request contains the exact new `goalId` (3/3 focused UI tests pass).

## 2026-08-02 — Legacy autonomous executor disabled

`lib/cognitive/twin-agent.ts` no longer runs its legacy autonomous capability list. That list could create tasks/routines, reschedule work, write Calendar, or message Slack from heuristic fatigue/load conditions without human confirmation. `lib/inngest/functions/process-twin-signal.ts` also clears those health-like legacy composites before persistence and suppresses their evolution logs. Confirmed, idempotent Novo Loop actions remain the only mutable path. Focused ESLint and strict TypeScript pass. This is a safety correction; a future proposal-only agent flow would require its own confirmed execution evidence.

## 2026-08-02 — Current validation gates

Current gates pass: `npm run lint` (0 errors, 6 inherited warnings), `npm test -- --runInBand` (53 suites / 175 tests / 2 snapshots), `npx prisma validate`, isolated test migrations (22 applied, none pending), and `NODE_OPTIONS=--max-old-space-size=4096 npm run build` (9m26s; compile, TypeScript, 127/127 static pages). The baseline-data and middleware-convention notices are pre-existing technical debt. No deployment follows from these gates alone because legacy metric/action surfaces remain a completion requirement.

## 2026-08-02 — Shareable summary reclassified

`components/cognitive/share-cognitive-card.tsx` no longer displays or copies a percentage labeled as fatigue risk. It shares only selected planning context, work style, preferred window, and explicitly estimated operational workload. Focused lint, relevant UI/safety tests (4/4), and strict TypeScript pass.

## 2026-08-02 — Generic cognitive-execution bypass closed

`POST /api/ai/execute` previously accepted legacy cognitive-state actions directly. It now rejects `UPDATE_COGNITIVE_STATE` and `COGNITIVE_PIPELINE` with `409 ConfirmationRequired`; execution must use the persisted Novo Loop confirmation path. `app/api/ai/execute/route.test.ts` proves both variants do not invoke the executor (2/2 PASS; focused lint passes).

## 2026-08-02 — MCP catalog narrowed to executable safe operations

The MCP catalog no longer advertises `delete_task`, `create_calendar_event`, `create_routine`, `generate_day_plan`, or `run_twin_agent`. They either could mutate outside the confirmed Loop or advertised a capability intentionally disabled for safety. The isolated E2E asserts their absence while retaining scope/ownership/audit/idempotency coverage (5/5 in 53.5s; focused lint passes).

## 2026-08-02 — Activity recovery polish backed by real events

`NovoActivitySurface` now retries an SSE/polling connection in place rather than reloading the entire page; the Loop no longer renders a duplicate spinner alongside the real activity state. Activity/Loop tests pass 6/6 and focused lint passes.

## Executive summary

Novo is not yet a complete closed-loop system. The previous vertical slice is real for authenticated Today users: it persists a state check-in, selects one task/goal action with deterministic rules, persists a plan, records responses, and can create one confirmed Google Calendar block. It was not complete because outcome feedback was only partially used, the chat had no shared activity lifecycle, and several cognitive surfaces outside the slice still expose estimates or defaults as if they were measurements.

This audit is based on the current worktree, Prisma schema/migrations, route code, targeted tests, a full Jest run, and production build evidence from Vercel deployment `dpl_Eg3KKnKqVGjRkegEWgXbvEFi4L1o`. The new activity implementation adds a shared, persisted operational run/event contract without storing prompts, tokens, credentials or private chain-of-thought.

### Latest validation correction (2026-08-02)

- Local public-review evidence: unauthenticated browser automation and a generic automated user agent both received direct `/landing` HTTP 200 with meaningful first-response HTML. The route exposes crawlable sign-in/sign-up/reviewer, pricing, support, terms, privacy and refunds links plus canonical metadata. The rendered viewport was visually inspected. This is local runtime evidence; it is not a new production-host smoke check.
- Legacy AI cognitive updates are no longer auto-executed from a parsed model response: `app/api/ai/generate/route.ts` sends them through its confirmation UI. The execution route no longer logs raw action/result JSON and returns safe errors. This reduces unsafe inferred-state writes but does not reclassify older persisted snapshots as observed facts.
- `lib/ai/context-builder.ts` no longer falls back to a fabricated `low` fatigue state or logs raw caught diagnostics. Daily-summary and insight route fallbacks likewise return `unavailable` and sanitize caught errors. Focused safety/action tests pass. Legacy model-originated cognitive state fields are still classified as inference and remain outside verified biometric evidence.
- Current global gates: lint passed with zero errors and six inherited warnings; Jest passed 51 suites / 171 tests / 2 snapshots; strict TypeScript passed; and the current production Next build passed through all 127 pages when Node was given the required 4 GB heap (11m18s). The initial default-heap build failure is environmental capacity evidence, not a code compilation failure; the expanded-heap command is the successful authoritative build result.
- Current isolated runtime evidence: `scripts/validate-test-db.mjs` accepted only `novo-e2e-test` with `productionOverlap=false`; the normal and detect-open-handles E2E runs each passed five flows. This proves the synthetic ownership, feedback, signal-exclusion, MCP-scope/audit and Calendar-idempotency paths against the isolated database. It does not substitute for a fresh production task mutation.
- The operational fallback no longer derives a purported biometric stress score from tasks, workouts or productivity. `lib/db-biometrics.ts` emits unavailable physiological fields, `app/api/ai/cognitive-engine/route.ts` ignores unavailable biometrics for recovery logic, and `lib/cognitive-context.tsx` does not inject a neutral stress default. `components/cognitive/burnout-risk-meter.tsx` and `components/cognitive/focus-score-ring.tsx` label their remaining task/session values as operational estimates and not diagnoses or mental measurements. Focused biometric/engine tests and TypeScript validation pass; legacy cognitive presentation remains a separate audit item.
- The cognitive-engine route no longer invents historical average focus quality or productivity when no observations exist. It communicates missing history to the model and excludes the absent quality term from its operational index.
- A chat activity run now reaches an explicit safe `failed` terminal state even when a request fails before an SSE response is created. `app/api/ai/stream/route.ts` retains only the owner and run identifier at that outer boundary, then calls `finishActivityRun` with `chat_request_failed`.
- Evidence: `app/api/ai/stream/__tests__/twin-mode-gating.test.ts` injects a context-build failure and verifies both HTTP 500 and the persisted terminal transition; the focused suite passes all 5 tests.
- The custom wallpaper backdrop now has an isolated body stacking context in `app/globals.css`; this prevents its negative-z fixed rendering layers from being painted behind the opaque body background in Chromium desktop. `app/globals.test.ts` proves the required stacking and layer depth declarations.
- `lib/cognitive/task-priority.ts` now preserves the user's declared `high`/`medium` priority floor and ignores task-origin labels. The Twin may elevate for concrete deadline/activity facts but no longer demotes ordinary user work merely because an agent label is present. Targeted priority and decision-rule tests pass.
- Regression evidence after these corrections: the full Jest suite passes (44 suites, 158 tests, 2 snapshots) and lint has no errors. Existing test-fixture console diagnostics remain technical-debt noise rather than failures.
- The isolated E2E now uses the actual `POST /api/cognitive/loop/checkin` contract, including its required timezone, rather than a direct snapshot insert. Its detect-open-handles rerun passes all 4 tests against the verified test database. This is strong functional evidence for the synthetic closed-loop and MCP persistence path, but it is not evidence that a live production task was changed.
- Terminal operational outcomes in `NovoLoopCard` now require and persist the canonical structured reason rather than guessing it from translated prose. A focused component test proves that abandonment/failure controls remain disabled until a valid reason is selected.
- Signal correction/exclusion is now validated end-to-end: the isolated test excludes an owned task ledger record via the route, confirms its persisted exclusion timestamp, and proves the following plan chooses the objective fallback rather than reintroducing that task.
- Metric safety correction: `update_twin_metrics` has been removed from MCP because a free-form agent-provided source label cannot validate arbitrary cognitive or biometric values. The isolated MCP `tools/list` assertion proves this write surface is no longer advertised.
- Chat recovery correction: an interrupted provider stream now ends its owned activity run as `failed` rather than falsely `completed`; the focused route test simulates a reader disconnect and verifies the safe `chat_stream_interrupted` terminal code.
- Observability now includes first-visible-content latency for chat runs using `ai_first_visible_token`. It stores only run identity and duration, never message or model content, and is asserted to trigger once per stream.
- The biometric route now redacts logs/errors and does not fabricate a neutral stress score when fallback retrieval fails. Its focused route test verifies private diagnostic text is absent from the client response.
- Follow-up metric boundary: `hooks/use-peak-task-orchestrator.ts` no longer acts on the legacy productivity-derived burnout prediction, so it cannot surface a global high/critical health alert. `app/api/cognitive/patterns/route.ts` now keeps fatigue history empty rather than deriving it from DailyAnalytics and returns `410 DeprecatedSignal` for the legacy fatigue writer instead of converting arbitrary client input into fatigue/productivity snapshot fields. `app/api/cognitive/patterns/route.test.ts` proves both boundaries (2/2), with presentation-state regression tests also passing (3/3). This leaves the legacy predictor as an unused compatibility payload; it is not evidence of a verified health metric.
- The same orchestrator formerly invoked `/api/onboarding/day-plan` when a clock-derived peak state found an empty queue. It now stops at an informational no-task state, so estimated time-of-day cannot create plans/tasks outside the persisted Loop and its explicit response controls. Focus-queue hand-off of an existing real task remains user initiated.
- `POST /api/cognitive/insight` no longer accepts `fatigue` or `burnout` types because it has no source ledger or explicit check-in provenance. The new route test proves a logged-in caller cannot persist such a claim or update a snapshot through that endpoint.
- The Loop card now renders confidence as High/Medium/Low with a bounded explanation, using the persisted deterministic confidence rather than a fake precise percentage. Its component test verifies the medium-confidence limitation alongside the existing structured terminal-reason controls.
- The shared activity surface now merges late out-of-order SSE frames rather than dropping them while preserving the maximum recovery cursor. Its test proves a `2 → 1` delivery renders a `1 → 2` timeline; the existing test continues to prove owner-scoped polling fallback. The non-terminal indicator is a reduced-motion-safe pulse, not a continuous spinner.
- `finishActivityRun` now treats an identical terminal retry as idempotent: a repeated cancellation returns the same owned cancelled run and does not append an event. The isolated E2E asserts two cancellation calls leave exactly one terminal event.
- `POST /api/ai/generate` no longer logs its body, classifier reasoning, parseable model content or raw caught errors, and it no longer returns router reasoning in conversation metadata. A route test proves malformed private input receives only the safe generic error contract.
- The legacy Gemini command route now likewise avoids logging messages, provider output, tool arguments, caught errors or stacks, and returns a safe generic error envelope. Its route test verifies malformed input cannot receive parser/stack details.
- The legacy command route also no longer executes provider-selected functions: it has no confirmation or idempotency surface, so such calls become a `requiresConfirmation` proposal with no arguments exposed. Its test proves a mocked `create_task` call cannot invoke the executor.
- The web-search route no longer logs queries, provider URLs/bodies or raw failures. Missing provider configuration now returns the safe `SearchUnavailable` envelope; its route test proves the environment key name is not reflected.

## Previous mission: what is genuinely implemented

- Persistence exists in `prisma/schema.prisma` and migration `20260730110000_add_novo_loop_v1`: `CognitiveStateSnapshot`, `ActionPlan`, `RecommendedAction`, `OutcomeEvent`, `IntegrationPermission`, and additive Goal metadata.
- `POST /api/cognitive/loop/checkin` validates and persists user-reported energy, focus, workload, available minutes and context with ownership and source `checkin`.
- `POST /api/cognitive/loop/plan` reads the owned goal, latest snapshot, unfinished tasks and recent outcomes, then persists one deterministic plan/action transactionally.
- `POST /api/cognitive/loop/response` validates ownership, uses a unique idempotency key, creates accepted tasks when needed, updates action state, and records outcome events.
- `POST /api/cognitive/loop/calendar` requires an accepted action, Google Calendar scope/token, and an action marker before writing the external event; duplicate requests return the existing internal event.
- `components/cognitive/novo-loop-card.tsx` is reachable from `/today` and exposes facts, inferences, response controls and Calendar scheduling.

## Partial, mocked, decorative or disconnected behavior

- Learning previously queried only dismissals/postponements. This audit adds ranking penalties for unhelpful/intrusive recommendations and derives a bounded preferred successful action duration from persisted `RecommendedAction.startedAt`/`completedAt` in `app/api/cognitive/loop/plan/route.ts`; `lib/cognitive/decision-rules.ts` uses it only as a suggested block size.
- The old chat activity UI (`components/ai/modern-chatbot/thinking-steps.tsx`) showed a small client interpretation of model metadata, but had no persisted run, ordered phase contract, reconnect cursor, cancellation or terminal activity state.
- `app/api/ai/stream/route.ts` can return a demo message when no provider key exists. That is an explicit fallback, not a live AI result, and must remain visibly distinct from successful provider output.
- The earlier `Math.random()` graph placement has been replaced by a stable node-ID hash in `components/cognitive/cognitive-graph-view.tsx`; it is decorative layout only, never a cognitive metric.
- The earlier confidence bootstrap of `42` was removed. `lib/cognitive/get-or-create-twin.ts` and the database default now use an uncalibrated zero state, which UI labels rather than presenting as measured confidence.
- The old cognitive engine still contains time/activity-derived estimates. They are useful recommendations only when labeled as estimates, not biometrics.
- No end-to-end test currently proves objective → check-in → plan → accept → complete → helpful → next plan against a real database.

## New activity protocol

### Data model

Migration `20260731090000_add_ai_activity_runs` adds:

- `AiActivityRun`: owner, surface (`novo_loop` or `chat`), current phase/sequence/status, timestamps, expiry, sanitized tool name, pending confirmation, result reference/summary and safe error fields.
- `AiActivityEvent`: ordered `(runId, sequence)` event records with phase, user-facing label/detail, source count, sanitized tool name, confirmation/recovery/terminal flags.

Neither table stores prompts, model tokens, chain-of-thought, credentials, raw tool arguments or private content unless needed as a short safe result reference.

### Contract and recovery

`lib/ai/activity-contract.ts` defines the shared phases and `NovoActivityEvent`; `mergeNovoActivityEvents` ignores duplicate/stale sequences and sorts out-of-order frames. `lib/ai/activity.ts` enforces owner lookup, monotonic sequence writes, safe tool allowlisting, terminal state transitions and opportunistic expiry cleanup.

Routes:

- `POST /api/ai/activity/runs` creates an owned run.
- `GET /api/ai/activity/runs/:runId?after=N` returns the run and events after a cursor.
- `GET /api/ai/activity/runs/:runId/stream?after=N` polls persisted events as SSE and terminates on completed/failed/cancelled/expired.
- `POST /api/ai/activity/runs/:runId` with `{action:"cancel"}` records cancellation.

The Novo Loop creates a run before planning and emits real context, interpretation, prioritization and planning phases. The chat creates the same run type and includes `runId` in its existing metadata SSE frame; the shared activity surface can reconnect independently from answer text. `components/ai/novo-activity-surface.tsx` resumes SSE from its latest cursor and falls back to authenticated polling at `GET /api/ai/activity/runs/:runId?after=N` if SSE disconnects.

Retention is bounded by expiry plus `lib/ai/activity-retention.ts`: the daily authenticated `GET /api/cron/activity-retention` job (scheduled in `vercel.json`) expires abandoned active runs, removes terminal event detail after 30 days, and deletes terminal run records after 90 days. External action execution audits are retained independently.

## Loop stage assessment

The table below is the current assessment; earlier historical entries in this document intentionally retain the state observed at the time of the first audit.

| Stage | Score | Evidence | Remaining gap |
|---|---:|---|---|
| Observe | 4/5 | Isolated E2E persists the owned objective, check-in, tasks and prior outcomes; optional Calendar context remains permission-aware | Calendar/commitment/project inputs are not all normalized into one context source ledger. |
| Interpret | 4/5 | `deadlineUrgency`, observed task-inactivity priority and deterministic task filters | Conflicting-commitment and dependency rules still need an owner-scoped normalized input. |
| Prioritize | 4/5 | One action, deadline/priority/energy scoring, facts/inferences | User-declared goal priority is not a complete override policy. |
| Intervene | 5/5 | `NovoLoopCard` exposes facts/inferences, correction, signal/source exclusion, accept/modify/postpone/dismiss and intrusive feedback; isolated E2E proves owned persistence and cross-user separation | Visual authenticated-session proof remains useful but is not a functional gap. |
| Execute | 4/5 | Accepted task creation, server-validated `modified` next-step payload and confirmed Calendar write; `ExternalActionExecution` claims a unique operation key before provider dispatch, and E2E proves duplicate protection | A real external provider invocation/retry remains intentionally unproven in the isolated test. |
| Verify | 5/5 | E2E persists start, completion and helpful feedback; the UI exposes postpone, abandon and failed transitions with structured reasons and stale-accepted remediation | Authenticated visual proof remains useful but is not a functional gap. |
| Learn | 4/5 | Dismiss/postpone/unhelpful/intrusive feedback changes ranking; completed duration changes future suggested block size; E2E proves a prior outcome changes the next plan | Modified format and preferred time-of-day learning remain missing. |

## Security, privacy, performance and database risks

- The chat stream route no longer emits raw user messages, provider response bodies or caught exception objects to logs. Remaining diagnostics are bounded operational metadata, which supports observability without retaining content from the prompt or provider.

- Chat fallback/error SSE frames now include the persisted activity `runId`, enabling the shared client surface to reconnect/poll and inspect the terminal state. Internal provider/configuration information is not shown in the response body.

- Chat provider exhaustion in `app/api/ai/stream/route.ts` now ends the shared persisted activity run as `failed` and emits a safe response. The focused test verifies an upstream diagnostic cannot reach the client. Other legacy `Novo Brain` debug logs remain audit debt and are not claimed as sanitized by this fix.

- Local production build evidence was refreshed on 2026-08-02 using Next's split compile/generate modes: compilation passed in 311.7 seconds and generation passed 127/127 pages in 37.0 seconds. The only notices were the existing baseline-browser mapping update and middleware-to-proxy deprecation.

- `lib/ai/executor.ts` was changed to prevent its persistence/logging layer from retaining raw AI action values. `AiActionLog` now stores a bounded `fieldNames` metadata object and a safe failure code only. The user-facing execution still receives its normal action result; the audit test explicitly verifies private title/description values are absent.

- `lib/auth.ts` no longer emits environment-presence diagnostics or OAuth redirect URLs at import/callback time. OAuth refresh failures now use bounded safe messages rather than token/provider error objects. `lib/__tests__/auth-import.test.ts` verifies that auth import and a code-bearing redirect do not emit logs.

- Post-change gates on 2026-08-02: TypeScript passed in 92.8 seconds; lint had 0 errors and the same 6 pre-existing warnings; the isolated Loop E2E passed 4/4 both normally and with `--detectOpenHandles` (the latter yielded no handle diagnostics). Its test-environment output still contains import-time missing-OAuth configuration logs, which are noise rather than successful provider access and remain configuration-hygiene debt.

- `components/cognitive/cognitive-engine-widget.tsx` now labels the deterministic workload-derived value as an estimated operational load rather than a burnout diagnosis. The persisted transport field is retained temporarily for compatibility; legacy fatigue terminology elsewhere remains a documented audit item, not evidence of a clinical signal.

- Terminal Loop feedback is now constrained by `lib/schemas/cognitive-loop.ts`: abandoning or failing a recommendation requires a bounded reason enum. `app/api/cognitive/loop/response/route.ts` persists only that enum and an optional bounded note, which gives later deterministic prioritization a safe, usable signal.

- `app/api/mcp/route.ts` now runs `lib/mcp/request-guard.ts` before auth and SDK dispatch. It rejects bodies larger than 64 KiB even without `Content-Length` and rejects JSON-RPC batches, so one HTTP request cannot invoke multiple MCP tools. The focused tests are `lib/mcp/__tests__/request-guard.test.ts`.
- A hard response timeout/cancellation is still intentionally not claimed: a response-only timeout can leave a database mutation or external write executing after the client receives an error. This needs abort-aware durable tool execution rather than `Promise.race` around the transport.

- Ownership filters are present on Loop routes and activity routes. Calendar credentials stay server-side. Generic analytics must continue excluding task bodies, prompts and OAuth data.
- Calendar writes use `ExternalActionExecution`'s unique `(userId, provider, operation, idempotencyKey)` constraint, created before provider dispatch. Provider errors are explicitly left `uncertain` rather than blindly retried under a new key.
- The plan route performs bounded parallel reads (goal, snapshot, up to 40 tasks, up to 30 outcomes). Activity polling is intentionally bounded to 80 × 750ms; production should use a durable push channel or background job for long tools.
- Jest was repaired by aligning the installed runner/environment to Jest 29 and the affected Prisma mocks. `npm test -- --runInBand` passed: 31 suites, 123 tests, 1 skipped. The output still contains pre-existing test-console noise for missing Spotify test credentials and React `act(...)` warnings.
- `npm run lint` completed with zero errors and six warnings: two page font warnings in `app/layout.tsx`, three missing `alt` warnings in `app/music/artist/[id]/page.tsx`, and one anonymous default export warning in `prisma.config.ts`. The local build exceeded this workstation's 300-second timeout without compiler output; Vercel compiled, type-checked, prerendered 154 pages, and deployed successfully.

## Completion score (current audit)

Observation 4, Interpretation 4, Prioritization 4, Intervention 5, Execution 4, Verification 5, Learning 4, Explainability 4, User control 4, Persistence 4, Security 4, Reliability 3, AI activity truthfulness 4, Visual quality 3, Accessibility 3, Mobile 3, Performance 2, Test coverage 4, Observability 2, Production readiness 4.

The product is therefore a **real but incomplete loop**, not a complete closed-loop system. The isolated E2E now proves the primary persisted Loop and MCP boundaries. Remaining gaps are deterministic interpretation breadth, provider-boundary proof, complete legacy metric classification, observability of client reconnect/polling, and authenticated visual/mobile evidence.

## Recommended implementation order

1. Add isolated database-backed integration/E2E fixtures for real ownership, recovery, cancellation, duplicate/out-of-order events and the full Loop.
2. Expose `started`, `abandoned`, `failed`, stale-accepted remediation and intrusive feedback in the user interface.
3. Add correction/exclusion controls and a source ledger to the explainability surface.
4. Expand learning to modified formats and preferred time-of-day, with consent-aware data provenance.
5. Replace remaining synthetic/default cognitive UI metrics or label every estimate clearly.
6. Instrument non-sensitive latency/tool/cancellation metrics and test mobile/reduced-motion visual behavior.

## Closed-loop completion gates (2026-07-31)

This milestone is intentionally limited to closing and proving the existing vertical slice. It must not add product modules, integrations, dashboards or decorative AI features.

1. Centralize and validate the recommendation state machine: `proposed → modified|accepted|postponed|dismissed`; `accepted → started|postponed|abandoned|failed|completed`; only non-terminal feedback can be attached after completion. Every transition is owned, idempotent, timestamped and audited.
2. Feed positive and negative outcomes into explicit versioned rules: dismissals, postponements, unhelpful/intrusive reports, completions, abandonments, modifications, observed duration and sufficiently repeated successful work periods.
3. Replace Calendar's marker-only idempotency with an atomically unique external execution record created before provider invocation.
4. Cancellation means more than a UI state: each route must check persisted cancellation before model/tool work and immediately before irreversible external writes. A provider request already in flight may be recorded as `cancellation_requested_after_dispatch`, not falsely claimed as cancelled.
5. Recovery means restoring persisted activity events after a sequence cursor, plus showing the current terminal/pending-confirmation result. It does **not** claim that a serverless request continues after the original stream ends.
6. Add scheduled retention: expire abandoned active runs, compact terminal event detail after 30 days while retaining safe terminal summaries/external execution audits, and preserve records referenced by active recommendations.
7. Repair Jest and lint configuration, then add an isolated database-backed full-loop test with two users and mocked provider boundary only.

Acceptance requires all local validation commands to pass, an explicit stale-accepted verification surface, atomic Calendar duplicate protection, real cancellation checks, recovery tests, and a production build.

## Isolated E2E environment gate (2026-07-31)

The configured shell did not expose `DATABASE_URL_TEST`; the guarded test setup aborted before issuing any database command. A separately supplied candidate was also rejected because its database identity did not include `novo-e2e-test`, `test`, or `e2e`. No production URL, schema, table, or data was touched. The database-backed E2E acceptance criterion remains unproven until a distinctly named test connection is injected and revalidated against production using sanitized host/database/fingerprint comparisons.

## Signal provenance update (2026-07-31)

`NovoSignalLedger` now has a source-level companion model, `NovoSignalSourcePreference`, in migration `20260731120000_add_novo_signal_source_preferences`. `GET`/`POST /api/cognitive/loop/signals` scopes all signal and source operations to the owner. The Today Loop’s explanation surface provides correction, individual exclusion and source exclusion; `POST /api/cognitive/loop/plan` applies those choices before scoring. This is implemented but cannot be scored as fully verified until the isolated database flow proves persistence and cross-user protection.

Metric presentation was tightened: new Twins use `0` / “uncalibrated” rather than a `42%` bootstrap fallback; dashboard confidence only shows a percentage when owned observed signals have produced one; cognitive load and recovery reserve are visibly classified as deterministic estimates. The graph remains a deterministic decorative layout, not a measurement. After this change `npx prisma validate`, `npm run lint` (zero errors, six pre-existing warnings), and `npm test -- --runInBand` (32 suites / 125 tests / 1 skipped / 2 snapshots) passed. `npm run build` exceeded the local 300-second command ceiling without compiler output, so it cannot be counted as a production-build pass. The isolated E2E criterion is also unproven.

The previously skipped `tests/actions.test.ts` action-confirmation test has been replaced by a real-runner test with only Groq mocked as an external boundary. It passed separately (1 suite / 5 tests / 0 skipped); the next full Jest run must confirm the repository-wide skipped count is now zero.

The legacy app-wide cognitive context was a separate source of fake completeness: it mapped time-of-day and task-cost heuristics to `SYNAPTIC_FATIGUE`/`REDUCED_CAPACITY_MODE`, which in turn dimmed pages, modified visual settings, started audio and warned against navigation. `lib/cognitive-context.tsx` now normalizes those states to `LINEAR_EXECUTION` before publishing them. This avoids presenting a deterministic estimate as a biometric/clinical reading. Lint passed after this guard with the same six pre-existing warnings.

The guard is factored in `lib/cognitive/presentation-state.ts` and has focused proof in `lib/cognitive/__tests__/presentation-state.test.ts` (3 passing cases). The complete Jest suite was rerun after the former skipped action test was replaced: 32 suites, 126 tests, 0 skipped, 2 snapshots.

## Instrumentation update (2026-07-31)

`lib/ai/activity.ts` now emits privacy-safe operational analytics for run start, first persisted phase, tool start, confirmation requested and terminal result/duration. All values are opaque identifiers, approved tool names, phase/status and elapsed milliseconds; no user content or provider credentials are included. This closes the server lifecycle portion of the observability requirement. Client reconnection/polling telemetry and database-backed verification remain unproven pending the isolated E2E environment.

`components/ai/novo-activity-surface.tsx` now differentiates completed, failed and cancelled states rather than showing a checkmark for every terminal run. It explicitly stops the continuous loader under `prefers-reduced-motion` and confines `aria-live` to the changing operational label. This is implementation and lint evidence; visual/mobile runtime evidence remains pending.

The former `modified` recommendation state had no payload change. `components/cognitive/novo-loop-card.tsx`, `lib/schemas/cognitive-loop.ts`, and `app/api/cognitive/loop/response/route.ts` now make modification a real, server-validated replacement of `nextStep`. The focused schema contract test passed; isolated database evidence for persistence/ownership remains pending.

Signal corrections now affect deterministic planning rather than only ledger display: the owned planner substitutes corrected objective/task labels before scoring, while individual/source exclusions always win and remove candidates. The implementation type-checks; isolated persistence and cross-user E2E evidence remain pending.

`scripts/validate-test-db.mjs` is now the required non-connecting safety gate for the isolated E2E flow (`npm run test:db:guard`). It sanitizes its output and rejects production overlap or a database identity without a test marker before any Prisma command can be issued. The current environment failed this gate before opening a database connection because `DATABASE_URL_TEST` is absent.

## Latest safety and runtime evidence (2026-07-31)

The supplied Neon console evidence names the test branch `novo-e2e-test` (database `neondb`). Because Neon branch identity is not present in the connection URL, the guard supports a temporary `DATABASE_TEST_BRANCH` marker. It still compares host, database and a sanitized SHA-256 fingerprint against `DATABASE_URL`, and rejects equal fingerprints. A rerun produced only `SAFE_GATE: MISSING_DATABASE_URL_TEST`; therefore no Prisma command or destructive database operation was attempted.

The desktop sprite behavior is intentional reduced-motion behavior. `components/ui/novo-sprite-loader.tsx` renders the sprite sheet, while `app/globals.css` animates it with `novo-companion-build` unless `prefers-reduced-motion: reduce` is active. Desktop runtime inspection reported `animationName: none` and `animationDuration: 0s`; mobile did not report reduced motion and animated normally. The fix is environmental/accessibility configuration (or an explicit user-controlled motion preference), not a change to frame coordinates. The static desktop frame preserves the status information required by the milestone.

The latest full local regression (`npm test -- --runInBand`) passed with 34 suites, 131 tests, 0 skipped and 2 snapshots. This strengthens the unit/integration evidence but does not replace the still-missing isolated database E2E proof.

The sprite now also honors the application-level `showAnimations` setting through `:root[data-animations="false"]`, while retaining the operating-system reduced-motion override. `npm run lint -- --quiet` passed after this change.

Production build evidence is now complete: the default `npm run build` process exhausted its Node heap during TypeScript, but `NODE_OPTIONS=--max-old-space-size=8192 npm run build` succeeded, including TypeScript, static generation of 155 pages and route optimization. This was a local resource limit, not a source compilation failure.

A final sanitized environment audit found no `DATABASE_URL_TEST`, Neon, E2E or alternate test-database variable; repository env files expose only `DATABASE_URL`. The isolated database proof therefore remains intentionally unexecuted.

The project is now wired for safe isolated execution: `lib/database-url.ts`, `lib/prisma.ts` and `prisma.config.ts` select `DATABASE_URL_TEST` only under `NOVO_ISOLATED_E2E=true`, reject equality with production, and fail closed when absent. `npm run db:migrate:test` uses `scripts/run-isolated-db-command.mjs` to apply the flag only to the child Prisma process and requires `DATABASE_TEST_BRANCH` evidence matching the Neon `novo-e2e-test` branch. Its current run stopped at `SAFE_GATE: DATABASE_URL_TEST missing`, before Prisma opened a connection.

Post-wiring checks passed: TypeScript no-emit, quiet lint and `lib/__tests__/database-url.test.ts` (3 tests). These checks prove the safety selection logic, not the unavailable remote database.

## Isolated proof update (2026-07-31)

The private `.env.test.local` file is explicitly loaded by the guard and isolated command wrapper; values are never logged. The required variables were present, the test branch was identified as `novo-e2e-test`, and sanitized connection identity checks proved that `DATABASE_URL_TEST` differs from the production connection. All database-affecting test commands were executed through `scripts/run-isolated-db-command.mjs`, which forces the child process to use the test URL and rejects unsafe overlap.

The guarded reset applied all 18 migrations on the isolated Neon branch. Historical migrations contained references to tables/columns absent from the repository's actual baseline; these were corrected with conditional SQL or current `"User"` references. Because the migration history still did not fully describe the current Prisma schema, `db push --accept-data-loss` was run only on the isolated branch to reconcile it. This is recorded schema-history debt, not evidence that production was modified.

The database-backed E2E now passes (`npm run test:e2e:isolated`: 1 suite, 2 tests). It proves persisted objective and check-in inputs, deterministic plan selection, ordered activity events and sequence recovery, complete recommendation lifecycle with helpful feedback, next-plan adaptation from the recorded 20-minute completion, user A/B ownership isolation, duplicate/out-of-order event handling and Calendar idempotency. Provider credentials are intentionally absent; the integration test stops at the persisted idempotency boundary and does not issue an external Calendar write.

Remaining production blockers are unchanged: real OAuth/provider execution still needs a separately authorized environment, migration history should be repaired additively so future fresh databases do not require reconciliation, and the Jest process reports a non-failing open-handle warning after the isolated suite despite explicit Prisma disconnect.

The reload gap discovered during this audit is now closed for the Novo Loop surface. `GET /api/ai/activity/runs` returns only the owner’s latest `running` or `awaiting_confirmation` run, and `NovoLoopCard` requests it on mount before reconnecting to the existing SSE/polling surface. The isolated E2E asserts this owner-scoped rehydration while the run is active. It deliberately does not return prompts, model reasoning, tokens or tool arguments.

The post-change lint check passed. The production build was then run through Vercel’s build environment: TypeScript passed, all 155 static pages were generated, serverless routes were traced, and deployment completed. Runtime inspection at `productivitynovo.vercel.app/cognitive` found the sprite loaded; desktop still reports reduced motion and therefore intentionally renders the final frame.

The repository-wide Jest gate is now green: 36 suites, 135 tests, 0 skipped and 2 snapshots. `tests/use-gemini-live-agent.test.tsx` uses a synthetic key only to exercise its mocked lifecycle; it does not contact Gemini. The remaining console output is expected missing-provider and mocked-context noise.

## Requirement-by-requirement audit (2026-07-31)

| Requirement from the proof document | Current evidence | Verdict |
| --- | --- | --- |
| Isolated persisted complete loop | `tests/novo-loop-isolated.e2e.ts`, real Prisma branch, 2 passing tests | Proven |
| A/B ownership and reload recovery | Owner-scoped activity GET plus E2E assertions for A and B | Proven |
| Ordered, duplicate and stale event handling | `appendActivityEvent`, `mergeNovoActivityEvents`, E2E and contract tests | Proven |
| SSE and polling fallback | `components/ai/__tests__/novo-activity-surface.test.tsx` forces `EventSource.onerror`, verifies the polling request and terminal state; production browser fault-injection remains out of scope | Proven at component boundary |
| Cancellation | Server terminal event and isolated E2E cancellation run both pass | Proven at protocol/database boundary |
| Provider failure and retry | Activity failed terminal state and retry run are covered; real provider outage injection remains untested | Partial |
| All recommendation states and structured reasons | State machine, response route and `NovoLoopCard` controls cover proposed/modified/accepted/started/postponed/completed/abandoned/failed/dismissed | Proven by code; UI runtime evidence pending |
| Signal correction and exclusion | Owned ledger, source preferences, planner filtering and correction controls | Proven by focused tests; full E2E persistence path not yet exhaustive |
| Synthetic metric classification | Dashboard labels and deterministic presentation guards are present; some decorative chart values remain explicitly classified | Proven by source/tests |
| Privacy-safe activity instrumentation | Server events are sanitized; reconnect/polling client telemetry is not yet emitted | Partial |
| Production validation after latest changes | Vercel build/deployment passed; public runtime and sprite presence verified. Authenticated behavior still requires an authorized session | Proven for deployment; auth runtime partial |

This matrix is intentionally conservative: code presence is not treated as runtime proof. The remaining gaps are test/observability coverage and the post-change production build, not an assertion that those behaviors are complete.

## Sprite diagnosis

`components/ui/novo-sprite-loader.tsx` renders `.novo-sprite-sheet`; `app/globals.css` animates the 4×2 sheet with `novo-companion-build`. On the production desktop runtime, the element was present and `matchMedia('(prefers-reduced-motion: reduce)').matches` returned `true`; computed style was `animation-name: none` and `animation-duration: 0s`, with the final frame transform. The mobile runtime did not report reduced motion and animated. The difference is therefore the desktop OS/browser accessibility preference. The CSS intentionally honors it and must not be overridden by the app’s visual setting. When reduced motion is active, the static final frame is the correct accessible behavior.
## Public review-access audit (2026-08-01)

The public review contract is explicit. `app/landing/layout.tsx` declares `/landing` as canonical with index/follow metadata. `app/robots.ts` allows the public site and excludes only private application areas/API routes; `app/sitemap.ts` publishes `/landing`, sign-in, sign-up, onboarding and policy URLs. The landing footer contains crawlable links for `/auth/signin`, `/auth/signup`, `/onboarding`, `/terms`, `/privacy`, `/refunds` and support.

The initial blank response was traced to `app/client-layout.tsx`, whose pre-hydration branch rendered only a loading shell. `middleware.ts` now forwards the request pathname as a non-sensitive internal header, and `app/layout.tsx` bypasses the authenticated client shell for `/landing` only. Authenticated routes, including `/`, retain the existing `ClientLayout` and provider boundaries.

Production evidence after aliasing the latest deployment to `https://productivitynovo.vercel.app` with `GenericReviewBot/1.0`: direct `/landing` returned HTTP 200 and meaningful HTML (hero, signup, onboarding reviewer link, support mail, terms/privacy/refunds and canonical metadata). The response contained no `h-screen w-full bg-background` loading placeholder. `/robots.txt` returned 200 with `Allow: /`; `/sitemap.xml` returned 200 and included `/landing`. Raw curl/Invoke-WebRequest is the JavaScript-disabled verification path.

The root request was tested separately. Production currently responds HTTP 200 at `/` with dashboard shell HTML and no `Location` header for a generic request; the source route still contains `getServerSession` and `redirect('/landing')`. This discrepancy is recorded as a runtime auth/session configuration item rather than silently claiming a redirect chain. The canonical review route itself is direct and does not depend on root behavior.

## Verification refresh and sprite root cause (2026-08-01)

Fresh gates passed: `npx prisma validate`, `npm run lint -- --quiet`, TypeScript no-emit and `npm test -- --runInBand` (36 suites, 135 tests, 2 snapshots). The isolated database guard accepted only `novo-e2e-test`, with a sanitized non-production fingerprint; `npm run test:e2e:isolated` then passed 1 suite / 2 tests after the test-only migration was applied. It still prints non-failing warnings for missing OAuth credentials and one Jest open-handle warning after completion; neither represents a production database operation.

The audit found one remaining bootstrap inconsistency: `getOrCreateTwin` created uncalibrated twins at zero, but the Prisma column default was still 42. Migration `20260801120000_remove_uncalibrated_twin_bootstrap` changes the database default to zero and changes only records at the legacy 42 value that are uninitialized and have zero signals. It preserves any observed/calculated score. The migration was applied only to the isolated test branch and its full Loop E2E passed afterward.

Desktop sprite reproduction is conclusive, not speculative. On `https://productivitynovo.vercel.app/cognitive` at 1280px, `.novo-sprite-sheet` existed and its computed style was `animation-name: none`, `animation-duration: 0s`, final-frame transform; `matchMedia('(prefers-reduced-motion: reduce)').matches` was `true`; `document.documentElement.dataset.animations` was unset. The decisive rule is `@media (prefers-reduced-motion: reduce)` in `app/globals.css`, which intentionally turns the cycle into a static final state. On the mobile environment the preference is not reduced, so the normal `novo-companion-build` 1.12-second cycle runs. This is an accessibility preference inherited from the desktop browser/operating system, not a broken PNG, frame calculation or Novo setting. Novo should not override that preference; enabling system motion in desktop accessibility settings is the user-controlled way to see the cycle.
## MCP device access and onboarding persistence (2026-08-01)

`prisma/schema.prisma` now defines `McpPersonalAccessToken`, with an additive migration at `prisma/migrations/20260801133000_add_mcp_personal_access_tokens`. `lib/mcp/personal-access-token.ts` hashes opaque `novo_mcp_` bearer tokens before persistence and validates expiry/revocation/owner scopes. The raw secret is returned exactly once by `app/api/mcp/tokens/route.ts`; `app/api/mcp/tokens/[tokenId]/route.ts` revokes only the authenticated owner’s token. `lib/mcp/auth.ts` recognizes these tokens before OAuth, while `app/api/mcp/route.ts` exposes the owner-scoped `get_pending_tasks` tool and preserves explicit write scopes for task mutation.

Evidence: `npm run test:e2e:isolated` passed 1 suite / 3 tests after the isolated migration. The third test creates two synthetic users, verifies only a digest is stored, rejects cross-user revocation and then verifies owner revocation invalidates the token. This is test-branch evidence only; production requires an existing `NEXTAUTH_SECRET` or a dedicated `MCP_TOKEN_PEPPER` to issue tokens securely.

The onboarding return-loop was traced to `lib/cognitive-twin-context.tsx`: persistence was fire-and-forget while `app/onboarding/page.tsx` immediately navigated. If the request was cancelled during navigation, `app/client-layout.tsx` correctly observed a non-initialized server Twin and redirected the returning user to onboarding. The final action now waits for a successful sync response, retries once and retains the final screen with localized recovery copy on failure. TypeScript passed after this change; interactive authenticated browser verification remains pending a signed-in account.

## MCP audit and idempotent action validation (2026-08-01)

The earlier connection check alone was insufficient. The current MCP evidence is `tests/novo-loop-isolated.e2e.ts`, backed by the isolated Neon branch. It sends Streamable HTTP JSON-RPC calls through `app/api/mcp/route.ts` using issued device tokens, rather than calling Prisma directly. It proves read-only access can read only user A’s objectives; the same token is denied task creation; a write-scoped token creates, starts and completes one task; repeating the creation key produces no second task; a recommendation transitions accepted → started → completed and creates three `OutcomeEvent` records; a `McpAuditLog` row exists for the mutation without containing the raw bearer token; expired and malformed device tokens return 401.

`McpAuditLog` is an additive persistence boundary (`prisma/migrations/20260801150000_add_mcp_audit_logs`). It retains sanitized actor/client IDs, owner, tool/action, resource ID, request ID, idempotency key, safe summary/status and timestamps. It does not retain token values, full arguments, OAuth credentials, prompts or private task content. Per-client/per-user in-memory rate limits and a 64 KiB content-length cap are enforced at the MCP route. Because a remote client’s `confirmed=true` is not a human confirmation, direct MCP deletion and Calendar writes are refused; they remain in Novo’s authenticated confirmation flow.
## Observability and metric classification refresh (2026-08-01)

`lib/cognitive/events.ts` now includes `mcp_tool_invoked` and `mcp_tool_completed`. The only payload written by `lib/mcp/audit.ts` is operational metadata: tool, action, resource type, sanitized client identifier, terminal result and optional safe error code. The writes are best-effort after the durable audit boundary, so analytics failure cannot affect an MCP action or lead to retry duplication. The isolated E2E checks that both event classes exist for the owner after a real Streamable HTTP MCP mutation.

The metric audit separates the operational Novo Loop from legacy cognitive UI. Objective/check-in availability/workload are persisted user-reported inputs; deadlines, postponements and task counts are observed facts; Loop scores and confidence are deterministic estimates/inferences and must be labelled as such. `app/cognitive/page.tsx` deliberately disables the legacy fatigue phase in its supported presentation. However, `lib/cognitive-engine.ts`, `lib/cognitive-context.tsx`, legacy voice/chat cards and plugin heuristics still contain fatigue/burnout terminology and numeric composites. These are not validated biometrics and must not be treated as medical assessment. This is a documented production-readiness gap; no claim of full metric compliance is made until that legacy copy and its navigation effects are removed or consistently reclassified.

| Metric family | Classification | Source / current boundary |
|---|---|---|
| Check-in energy, focus, workload and available minutes | User-reported | `POST /api/cognitive/loop/checkin`; persisted snapshot with owner scope. |
| Deadlines, task state, postponements, completions and Calendar context | Observed | Owned first-party records and permission-aware integration context. |
| Loop priority score and recommendation confidence | Deterministic estimate | `lib/cognitive/decision-rules.ts`; explanation exposes facts and limited inference. |
| AI plan narrative / inferred blocker | Model inference | Schema-validated server output; never presented as a measurement. |
| Twin confidence at initial setup | Uncalibrated bootstrap | `0` / “Sin calibrar”; never `42%`. |
| Cognitive graph positions | Decorative | Stable node-ID hash; never a score. |
| `cognitive-engine` focus/load composites and legacy voice values | Deterministic estimate, legacy | Must remain labelled operational; no verified physiology. |
| Legacy patterns fatigue/burnout trend | Disabled compatibility path | Route no longer derives it from productivity and rejects the writer; orchestrator no longer acts on it. |
## Production MCP verification after deployment (2026-08-01)

The owner-provided device credential was used only for a live, owner-authorized smoke test and is not persisted in this report. Before deployment, the public alias returned 14 tools; after `vercel --prod --yes` plus an explicit alias assignment, `productivitynovo.vercel.app/api/mcp` returned HTTP 200 and 18 tools, including `start_task`. `delete_task` remains present but guarded because an external boolean is not human confirmation.

The same live MCP session read one owned pending task and updated it to `in-progress`. A second read after deployment returned HTTP 200 and confirmed that exact task remained `in-progress`. This is evidence of real MCP persistence and ownership, not a fixture. The task was not falsely completed: the pending context-switching work is not the same as the audit/deployment work in this milestone. The credential should be rotated or revoked after the session because it was shared in chat.
## Final publication evidence (2026-08-01)

After the legacy metric copy/presentation guard, quiet lint and production build both passed. Vercel deployment `novo-desktop-7p5bs3uem.vercel.app` compiled the app and was explicitly aliased to `productivitynovo.vercel.app`. The final owner-authorized MCP request returned HTTP 200 with 18 tools, including `start_task`, and retained the guarded deletion tool. No secret value is included here.
## Structured outcome reasons and learning feedback (2026-08-01)

The previous UI displayed localized reason text but sent it only as an unstructured note. This is now corrected: `lib/schemas/cognitive-loop.ts` validates the stable reason enum, `components/cognitive/novo-loop-card.tsx` maps display labels to codes, and `app/api/cognitive/loop/response/route.ts` persists the code in the outcome metadata and terminal action state. The planner includes recent `abandoned`/`failed` outcomes and uses `too_large` or `lack_of_time` to constrain the next action to a smaller 15-minute step. `lib/cognitive/__tests__/decision-rules.test.ts` proves the feedback effect; focused schema/rule validation passed 2 suites / 9 tests.
## Adaptive outcome feedback publication (2026-08-01)

The latest production deployment includes structured reason persistence and deterministic feedback adaptation. Full unit tests report 37 suites / 139 tests / 2 snapshots with zero failures; isolated E2E reports 1 suite / 4 tests passed. Vercel deployment `novo-desktop-7laex3hk6.vercel.app` was aliased to `productivitynovo.vercel.app`, and the live MCP smoke test returned HTTP 200 with 18 tools including `start_task`.
## Evidencia adicional — 2026-08-02

- Checklist remoto consultado con `get_pending_tasks` y propiedad del usuario verificada por el MCP. Solo existe una tarea en curso relacionada con `context_switching`; no se falsificó un estado `done`.
- `npm run test:e2e:isolated`: PASS (4/4). `npm test -- --runInBand`: PASS (37 suites, 139 tests, 2 snapshots). TypeScript: PASS. `npm run lint`: PASS con 0 errores y 6 warnings heredados.
- La nueva tabla `mcp_security_events` y su migración están presentes en la rama aislada. El ledger registra rechazos de autorización sin bearer tokens ni argumentos privados.
- `npm run build` quedó bloqueado por workers Node que no terminaron ni emitieron progreso en el tiempo operativo; se canceló el proceso y no se hizo deploy/migración de producción. Este es un bloqueo de gate, no una afirmación de build exitoso.
- Adaptación de cola implementada: el Twin considera tareas creadas por el usuario y fuentes integradas, conserva la prioridad declarada como señal base, ajusta por deadline/estado de forma explicable y registra el motivo; evita crear catch-up/triage duplicados. Evidencia: `lib/cognitive/twin-agent.ts` y `lib/cognitive/__tests__/twin-agent-priority.test.ts` (3/3).
- Evidencia MCP: la tarea real de `context_switching` fue actualizada con `update_task` (HTTP 200, idempotencia) y confirmada mediante `read_tasks` como `done`. El cambio de estado es auditable; la cola muestra además duplicados históricos del agente, que la nueva lógica deja de generar.
- Build: Next detectó inicialmente una exportación síncrona inválida en un módulo `use server`; se corrigió separando `task-priority.ts`. TypeScript y el test de priorización pasan. El build íntegro aún agota el timeout operativo sin devolver código de salida, por lo cual sigue sin haber migración ni deploy de producción.
- Checklist manual incluido: el MCP ya no limita su lectura a `Task`; incorpora `ChecklistItem` con un tipo de recurso explícito y owner filter. El E2E aislado demuestra que A recibe su tarea manual y B permanece aislado. El Twin puede ajustar la prioridad de ambas colecciones sin crear una copia.
- Producción validada: migración de seguridad aplicada, build remoto Vercel exitoso y alias público actualizado. `/landing` respondió HTTP 200 con contenido/canonical y el MCP publicado respondió HTTP 200. Una consulta sanitizada confirmó recursos de checklist pendientes en la instancia publicada, cerrando la brecha observada en la captura.

## Evidencia de actualización de checklist y métricas (2026-08-02)

`update_checklist_item` en `app/api/mcp/route.ts` completa la paridad MCP para los `ChecklistItem` que el usuario crea directamente en `/checklist`. La herramienta está owner-scoped, requiere `tasks:write`, valida una actualización no vacía y una fecha ISO cuando corresponde, usa `claimMcpMutation`/`finishMcpAudit` para idempotencia y auditoría, y devuelve datos mínimos. `tests/novo-loop-isolated.e2e.ts` prueba la actualización de A, supresión de duplicado y denegación de B contra la base aislada real. El resultado fue 1 suite, 4 tests, 0 fallos.

La revalidación posterior muestra TypeScript sin errores, lint sin errores (seis warnings heredados), 39 suites/143 tests/2 snapshots y ambas fases de build Next exitosas (`compile` y `generate`, 127 páginas). El primer build monolítico agotó el timeout del runner y dejó procesos hijos; se verificaron como procesos del build actual, terminaron y el build se ejecutó limpio por fases. Esto no es un fallo del código de producción.

La auditoría de métricas corrigió dos fuentes activas de falsedad: `app/api/cognitive-twin/demo/route.ts` ya no destruye/siembra señales sintéticas y responde `410 synthetic_twin_demo_disabled`; `app/api/onboarding/analyze/route.ts` y `lib/cognitive-twin-context.tsx` inician métricas como no calibradas, no como porcentajes o diagnósticos. `components/settings/settings-twin.tsx` muestra ese estado explícitamente. Permanecen superficies legacy fuera del Loop que requieren reclasificación antes de afirmar cumplimiento total de la auditoría de métricas.

## Prueba operativa de una tarea real (2026-08-02)

El despliegue `novo-desktop-8209fukb7.vercel.app` pasó el build remoto de Vercel y se asignó a `productivitynovo.vercel.app`. La comprobación MCP de producción devolvió HTTP 200/SSE, enumeró `update_checklist_item` y encontró cinco elementos de checklist pertenecientes al propietario. Después de finalizar la auditoría documentada del producto, el agente actualizó únicamente el ítem real de auditoría usando esa herramienta. La respuesta fue `completed=true`; una lectura posterior devolvió cuatro pendientes y confirmó que ese identificador ya no aparece. Esto demuestra la secuencia agente autorizado → trabajo de repositorio → actualización persistida/auditable → lectura de verificación para un elemento creado por el usuario, sin acceso directo a base de datos.

El detalle de bearer, títulos, ids de recursos y claves de idempotencia se excluye deliberadamente de esta documentación. Las otras tareas manuales continúan abiertas hasta que exista evidencia de su ejecución; no se convierten automáticamente en `done` por prioridad inferida.

Como aplicación práctica de la priorización adaptativa, el agente ajustó por MCP la incidencia visible de wallpaper de PC a `high` y dejó la mejora de gráficos sin una especificación de biblioteca confirmada en `low`; las demás tareas permanecen en `medium`. Esto cambia el orden de atención, no el estado de ejecución, y se registra en la misma auditoría owner-scoped.

## Hallazgo y corrección de falsos datos en chat (2026-08-02)

`components/ai/modern-chatbot/context.tsx` tenía una rama client-side que construía un card cognitivo con foco `75`, carga `35` y capacidad inferida aun cuando la acción no incluía esas señales. Esa conducta se eliminó. `CognitiveUpdateCard` muestra `Sin datos` para foco, carga y capacidad hasta que exista un valor recibido. `components/ai/modern-chatbot/blocks/cognitive-update-card.test.tsx` se escribió primero, falló con el comportamiento anterior y pasó luego de la corrección; TypeScript no reporta errores. Esta eliminación no convierte las superficies legacy restantes en métricas verificadas: sigue siendo necesario reclasificarlas.

La publicación de esa corrección pasó lint (0 errores/6 warnings heredados), 40 suites/144 tests/2 snapshots, E2E aislado 4/4 y las fases Next compile/generate (127 páginas). Vercel completó el build remoto y el alias de producción se actualizó a `novo-desktop-mqbndb8jz.vercel.app`.
# Latest continuation — orb y monetización (2026-08-03)

Revalidación posterior: wallpaper/blur 3/3 y despliegue Vercel actualizado con alias `productivitynovo.vercel.app`; `/landing` y `/terms` responden 200.

- shadcn ya estaba inicializado y se preservó su configuración.
- `thinking-orbs@0.2.0` se integró mediante `components/ai/novo-thinking-orb.tsx`; fases terminales quedan estáticas y la desconexión usa `connecting`.
- El checkout Lemon Squeezy está configurado en `.env.local`; el test de handoff pasa. No se imprimieron secretos.
- El vídeo SaaS explainer está especificado en `docs/raylight-saas-explainer-production.md`; el render Raylight sigue pendiente porque esa herramienta no está instalada ni conectada en este entorno.
- Despliegue actualizado: `productivitynovo.vercel.app` apunta a la versión con wallpaper/blur y Thinking Orb; Vercel build PASS con 127/127 rutas. Canario HTTP: landing/terms 200 y MCP sin token 401.
- El único pendiente explícito del checklist sigue siendo Bklit UI; no se falsificó su resolución instalando un paquete Vue incompatible.
# Visual polish evidence — 2026-08-03

The reference-inspired visual layer is implemented in `app/globals.css`:

- `[data-app-viewport]` receives a restrained dither/noise texture and slowly drifting green/teal ambient gradient.
- Dialog surfaces receive the same texture language through isolated pseudo-layers, while child controls remain above the effect.
- The animation is disabled for `prefers-reduced-motion`.
- No persistence, business rules, or external integrations were changed by this pass.
- Focused evidence: `npx jest app/globals.test.ts components/ai/__tests__/novo-thinking-orb.test.tsx --runInBand` passed (6/6 tests).
- Full lint/type-check was attempted but the local Node process did not complete within the environment timeout; no diagnostic output was produced.
- Production evidence: Vercel deployment `novo-desktop-9zr0eo2f0.vercel.app` completed its Next.js build (127 routes) after `prisma generate`; alias `productivitynovo.vercel.app` points to it. Direct `/landing` and `/terms` checks returned HTTP 200.
- Follow-up visual deployment `novo-desktop-lo7161kq2.vercel.app` also passed the complete 127-route build; `productivitynovo.vercel.app/landing` returned HTTP 200 after alias update.
- Current visual deployment `novo-desktop-9z7xof8gs.vercel.app` passed the complete 127-route build and is aliased to `productivitynovo.vercel.app`. The pass includes settings navigation texture/transition, pending-checklist hydration in NowHero, and the right-aligned notification control. `/landing` returned HTTP 200.
- Latest visual deployment `novo-desktop-msc453htc.vercel.app` passed the complete 127-route build. Shared `liquid-glass` surfaces now receive a low-contrast noise layer for consistent visual language across the app; `/landing` returned HTTP 200.
- Current deployment `novo-desktop-dppy5hs3y.vercel.app` passed the complete 127-route build. Settings now has a responsive premium rail/capsule navigation matching the supplied reference pattern; `/landing` returned HTTP 200.
- Latest deployment `novo-desktop-jficjjzgj.vercel.app` passed the complete 127-route build. Shared empty-state and focus primitives now use the Novo primary accent instead of legacy violet; `/landing` returned HTTP 200.
- Latest deployment `novo-desktop-10bo4cu34.vercel.app` passed the complete 127-route build. Premium fields now animate a slow 18-second ambient gradient and stop cleanly for reduced-motion users; `/landing` returned HTTP 200.
# Cognitive page follow-up audit (2026-08-03)

The Cognitive surface was audited against the flagship Cognitive Twin brief. Persisted domain and loop primitives exist (`CognitiveTwinRecord`, `BehavioralSignal`, `ActionPlan`, `RecommendedAction`, `OutcomeEvent`, `NovoSignalLedger`), but the route remains a statistics-first composition. The current graph is a deterministic derived SVG view with a small fixed vocabulary and no lens/focus/inspector contract. See `docs/novo-cognitive-twin-audit.md` and `docs/cognitive-graph-architecture.md` for file-level evidence and the proposed staged architecture.
# Latest validation evidence — 2026-08-04

## Remote build gate and core UI cleanup — 2026-08-04

- Preview `https://novo-desktop-nfl0d0ksk.vercel.app` passed Vercel's complete build. The remote log records successful compilation in 82s, TypeScript, page-data collection, 128/128 static pages, trace collection, function creation and deployment completion.
- Root cause of the prior Preview failure: `lib/openrouter.ts` threw `OPENROUTER_API_KEY env var is not set` at import time while collecting `/api/onboarding/analyze`, `/api/onboarding/day-plan` and `/api/routines/parse`. The key is now resolved lazily only when a provider request is attempted.
- The build remains a Preview-only proof; no production alias was changed by this pass.
- Stable activity recovery is now reachable at `/activity`, and the chat has a `/chat` route alias while preserving `/ai` as the authenticated implementation route.
- gstack browser checks: `/landing` 200 with server-rendered product/pricing/policy content and canonical metadata; `/activity` 200; `/cognitive` 200; responsive screenshots captured at mobile/tablet/desktop sizes.
- Production promotion completed as deployment `novo-desktop-gqitoffvh.vercel.app`; Vercel reported Ready after the same 128-route build. Canary against `https://productivitynovo.vercel.app/landing` returned HTTP 200 with the expected server-rendered copy and canonical metadata.

The strategic review narrows Novo's proof obligation to the execution loop between founders and agents. Current evidence: full lint has no errors, global TypeScript passes, and the complete Jest suite passes with 58 suites, 190 tests and 2 snapshots. The new Command Center reads persisted owned records and exposes lenses, explanation, relationships and signal exclusion. `npm run build` still exceeds the execution window without diagnostics, so production readiness and deployment remain open.
# Cognitive Twin flagship validation addendum — 2026-08-04

- The new Command Center now includes a searchable, keyboard-accessible alternative context list and keeps graph node visibility aligned with the search query. Signal exclusion now treats non-2xx responses as failures and preserves the previous snapshot instead of reporting an optimistic success.
- Component coverage: `components/cognitive/__tests__/cognitive-command-surface.test.tsx` verifies snapshot loading and context filtering.
- Latest global gates: Jest 61 suites / 197 tests / 2 snapshots; strict TypeScript PASS; lint PASS with 0 errors and 6 inherited warnings. The remote production build is green; the local build remains resource-limited only.
- Isolated database E2E rerun: 1 suite / 5 tests PASS against the guarded test environment. It covers objective → check-in → plan → lifecycle → feedback adaptation, ownership and event ordering, exclusion, revocable MCP scope and Calendar/MCP idempotency. Jest still reports its known delayed-exit warning after success.
- The same isolated suite rerun with `--detectOpenHandles` passed 5/5 without an open-handle diagnostic.
- Projection refinement: persisted Twin bottlenecks now appear as explicitly inferred blocker nodes, and repeated evolution events become bounded pattern nodes; both carry non-high confidence and remain lens-filtered.
- Remote production gate: `vercel deploy --prod --yes` completed as deployment `novo-desktop-o2z5pikl7.vercel.app`; Vercel compiled successfully, ran TypeScript, generated 127/127 routes and created serverless functions. The deployment was aliased to `https://productivitynovo.vercel.app`.
- Canary with a generic automated-browser user agent: `/landing`, `/robots.txt`, `/terms`, `/privacy`, `/refunds` and `/cognitive` returned HTTP 200. `/landing` returned 48,485 bytes and contained canonical metadata and Novo content. `/cognitive` is server-rendered as the authenticated shell; Command Center content hydrates client-side after auth/data resolution.
- Browser evidence from Playwright at `390x844` with reduced motion: `/cognitive` returned 200, onboarding contained the truthful “Evidence-based context” copy, and contained no `biometric` or `telemetry` promise; no continuous `animate-*` classes were present. Screenshot: `docs/cognitive-mobile-reduced-2026-08-04.png`.
- Follow-up deployment after the onboarding truthfulness fix: `novo-desktop-msrw4yg1s.vercel.app`, aliased again to `productivitynovo.vercel.app`; remote build completed successfully with 127/127 routes.
- Authenticated isolated browser proof initialized a synthetic Twin and reached `Centro Cognitivo`; the guarded graph API returned HTTP 200 for a synthetic Pro fixture and returned persisted nodes. Screenshots: `docs/cognitive-authenticated-desktop-2026-08-04.png` and `docs/cognitive-authenticated-mobile-2026-08-04.png`. The local dev server was resource-sensitive during client hydration, so interactive inspector/lens browser behavior remains an explicit evidence gap.
- Follow-up reliability fix: `lib/cognitive-twin-context.tsx` now bounds authenticated Twin hydration to 10 seconds, and `components/cognitive/cognitive-command-surface.tsx` bounds graph retrieval to 15 seconds with an honest error state. Production deployment `novo-desktop-87jeqyes5.vercel.app` passed the full Vercel build and is aliased to `productivitynovo.vercel.app`; public generic-agent canary remained green (HTTP 200).
- Local authenticated retry confirmed the bounded error copy appears when the dev runtime emits `Transition was skipped` before the graph request; no blank/indefinite loader remains. Interactive graph browser evidence is intentionally not claimed from that unstable local runtime.
- Final production deploy containing the truthful empty/error fallback: `novo-desktop-7nnw1wtlt.vercel.app`, aliased to `productivitynovo.vercel.app`; Vercel build generated 127/127 routes successfully.
- Final deploy containing the retry control: `novo-desktop-3sov434xs.vercel.app`, aliased to `productivitynovo.vercel.app`; Vercel again completed 127/127 routes.
- Hydration isolation fix: `/cognitive` bypasses the global `PageTransition` wrapper to prevent the dev-only `Transition was skipped` interruption from blocking client effects. Remote Vercel deployment `novo-desktop-5e20f0exu.vercel.app` passed 127/127 routes and is the current alias target.
- Additional isolation: `AuthenticatedWidgets` no longer mounts notification/chat/music motion surfaces on `/cognitive`, reducing hydration contention while retaining them across all other authenticated routes. Deployment `novo-desktop-i54g6tgzq.vercel.app` passed 127/127 routes and is aliased to `productivitynovo.vercel.app`.
