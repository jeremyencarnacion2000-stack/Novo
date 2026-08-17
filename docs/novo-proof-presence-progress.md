# Novo Proof & Presence progress

## UI cleanup addendum — 2026-08-04

Primary navigation is now Today/Cognitive/Chat/Activity, mobile uses the same labels through i18n, and secondary modules remain reachable without competing for attention. No destructive route or data deletion was performed.

## 2026-08-04 - Cognitive Center interaction evidence

- Added and passed a deterministic UI test for lens switching, signal-node inspection, evidence display, and signal exclusion (`components/cognitive/__tests__/cognitive-command-surface.test.tsx`, 2/2).
- Full Jest gate now passes 61 suites / 198 tests / 2 snapshots. No runtime code changed after the current production deployment; the additional change is test coverage and documentation only.
- The authenticated browser gap remains recorded rather than overstated: local hydration is resource-sensitive, while route/API, isolated E2E, accessibility semantics and deterministic component behavior are covered.
- Mobile interaction is now represented by the existing bottom Sheet primitive: node selection opens a draggable inspector with evidence and exclusion controls; lens selection is persisted in the URL. Production deployment `novo-desktop-qxqsd3nj6.vercel.app` was aliased to `productivitynovo.vercel.app`; remote build generated 127/127 routes and public canary checks returned 200.
- Fresh isolated verification after deployment: `npm run test:e2e:isolated -- --detectOpenHandles` passed 1 suite / 5 tests in 47.665s with no retained-handle diagnostic.
- Final redeploy after the hydration-safety adjustment: `novo-desktop-dwg4k5aga.vercel.app` aliased to `productivitynovo.vercel.app`; Vercel compiled, type-checked and generated 127/127 routes successfully. Public canary checks for `/landing`, `/cognitive` and `/robots.txt` returned 200.
- Final redeploy after focus-mode wiring: `novo-desktop-1xl8rkqtt.vercel.app` aliased to `productivitynovo.vercel.app`; remote build generated 127/127 routes. Full Jest remains 61/198, strict TypeScript and focused ESLint pass.

## 2026-08-02 - Production deployment and real MCP task evidence

`vercel deploy --prod --yes` completed successfully for the linked `novo-desktop-mvp` project. Vercel initially exposed SSO protection, so the public reviewer route was inaccessible; `vercel project protection disable novo-desktop-mvp --sso` removed only that project-level SSO gate. The deployment was then aliased to `productivitynovo.vercel.app`.

HTTP evidence against the live alias: `/`, `/landing`, `/robots.txt`, `/terms`, `/privacy`, and `/refunds` all returned direct `200` responses; `/landing` returned 49,413 bytes of server HTML with the Novo title and crawlable sign-in/sign-up/policy links. No root redirect was observed. The gstack browser daemon crashed twice during its canary attempt, so a visual screenshot and console-level browser evidence remain unavailable; this is documented rather than inferred as clean.

With a generic automated-reviewer user agent and JavaScript disabled at the transport level, `/landing` still returned HTTP 200, meaningful server HTML, product description, and pricing text.

Using the authorized MCP device token through the live `https://productivitynovo.vercel.app/api/mcp`, Codex initialized successfully (HTTP 200), read 4 real pending checklist items, and completed exactly 3 items whose repository work is present: wallpapers, demo script/preparations, and variable card blur. A follow-up `get_pending_tasks` returned only the unresolved Bklit item. The Bklit item was not falsified as complete because the only verified package is a Vue 3 port incompatible with Novo's React chart stack.

Unauthenticated `GET /api/mcp` on the live alias returns `401 Unauthorized`, confirming that public review access does not make the MCP resource public.

## 2026-08-02 - MCP read audit and sync idempotency tightened

`app/api/mcp/route.ts` now audits routine reads, integration reads, and all four MCP resource reads with sanitized summaries. `trigger_plugin_sync` now requires a UUID idempotency key, claims the mutation before syncing, returns the prior result for duplicates, and records a safe failure when the plugin call throws. The isolated E2E asserts the published tool schema includes the idempotency requirement; it passed 5/5 after the change. Focused ESLint and strict TypeScript passed.

The full post-change gate also passed: `npm run lint` (0 errors, 6 inherited warnings), `npm test -- --runInBand` (56 suites / 181 tests / 2 snapshots), and `NODE_OPTIONS=--max-old-space-size=4096 npm run build` (127/127 routes). Build notices remain limited to baseline-browser-mapping freshness and Next middleware deprecation.

## 2026-08-02 - Isolated migration gate cleared

After the external advisory lock released, `npm run db:migrate:test` completed against the guarded `novo-e2e-test` database and reported `No pending migrations to apply.` The immediately following `npm run test:e2e:isolated` passed 1 suite / 5 tests in 54.5 seconds, covering the persisted Loop feedback adaptation, ownership and event recovery, signal exclusion, revocable MCP token scopes, and MCP task-work audit/idempotency. Jest still emits its delayed-exit cleanup notice after success.

## 2026-08-02 - bklit UI package compatibility check

The only exact npm match is `bklit-vue-charts@0.1.0-beta.4` (repository `abdrizik/bklit-vue-charts`), described as a Vue 3 port of bklit-ui. Its peers are `vue`, `motion-v`, and `@vueuse/core`; the application is Next.js/React and already uses React chart primitives. It was not added as an unused/incompatible dependency. The task needs a React-compatible official package or a concrete design reference before it can be applied safely.

## 2026-08-02 - Final gate rerun: functional checks pass; test migration lock remains external

`npx prisma validate` passed. The isolated database guard accepted only the `novo-e2e-test` branch with `productionOverlap=false`. A read-only PostgreSQL lock inspection found another active session holding Prisma's advisory migration lock on that isolated database; therefore `npm run db:migrate:test` returned `P1002` twice and was not bypassed, force-reset, or terminated. No production connection was used.

All non-migration gates in the same rerun passed: `npm run lint` finished with 0 errors and 6 inherited warnings; `npm test -- --runInBand` passed 56 suites / 181 tests; `npm run test:e2e:isolated` passed 5/5 isolated Loop, MCP, ownership, event ordering, retry and Calendar-idempotency flows. Strict TypeScript passed separately after the metric changes. Jest printed a delayed-exit notice after the successful isolated suite; it remains runner-cleanup debt. Production build is pending this recorded migration-lock condition and must not be treated as a deployment approval.

`NODE_OPTIONS=--max-old-space-size=4096 npm run build` then passed: Next compiled successfully, completed strict TypeScript and generated 127/127 routes. The only build notices were inherited baseline-browser-mapping freshness notices and the Next middleware-to-proxy deprecation notice. The build result does not remove the isolated migration-lock gate or authorize deployment.

## 2026-08-02 - Legacy metric rendering narrowed

`lib/cognitive-graph.ts` no longer exposes persisted `burnoutIndex` values as a graph node or correlation. The remaining load node is explicitly marked `Carga operativa estimada (no biométrica)`, and legacy fatigue/burnout log types appear only as an unused historical signal. `components/settings/settings-twin.tsx` no longer renders the old overload/decision-friction metric pills. `CognitiveMetricsStrip` and `/api/cognitive/metrics-history` no longer derive a “reserve” from `100 - burnoutIndex`; the section is now labelled operational indicators. `lib/__tests__/cognitive-graph.test.ts` proves the graph omission and the operational label. Focused ESLint and strict TypeScript PASS.

## 2026-08-02 - Activity retry telemetry completed

`NovoActivitySurface` now emits the sanitized `ai_run_retry` telemetry event before reconnecting after a manual retry. The server accepts only the enum-backed telemetry event for the owner of the run, stores only `runId`, and ignores transport errors without breaking recovery. `components/ai/__tests__/novo-activity-surface.test.tsx` covers polling fallback, manual retry telemetry and out-of-order timeline merging (3/3 PASS); focused ESLint passes.

The isolated E2E was then rerun after adding owner enforcement for telemetry: user B receives 404 for user A's run, while user A persists exactly one `ai_run_retry` event containing the run reference only. `npm run test:db:guard` accepted `novo-e2e-test` with `productionOverlap=false`; `npm run test:e2e:isolated` passed 1 suite / 5 tests in 57.4 seconds. Jest printed its generic delayed-exit warning after passing; no test failed.

## 2026-08-02 - Checklist work: safe Calendar confirmation and appearance controls

- `NovoLoopCard` now opens an explicit confirmation card before it sends a focus-block request to Google Calendar. `calendar-confirmation.test.tsx` proves the calendar route is not called until the user presses the confirmation control.
- `app/globals.css` now makes a custom wallpaper visible in desktop Chromium by removing the opaque body color only while the wallpaper layers are active. Standard card surfaces (`glass-surface` and `card--secondary`) now consume the independent `--card-blur-px` setting instead of hard-coded/sidebar blur values. `app/globals.test.ts` covers both CSS contracts.
- `docs/video-demo-saas-explainer.md` is the prepared 75-90 second Spanish demo script, capture checklist and deliverable list. No real user data should be recorded.
- Evidence: `npm run lint` completed with 0 errors and 6 inherited warnings; `npm test -- --runInBand` passed 55 suites / 180 tests; strict TypeScript passed. No production deployment was performed, so those checklist items remain pending in the live app until the milestone's deployment gate is satisfied.
- `NODE_OPTIONS=--max-old-space-size=4096 npm run build` also passed: optimized compilation, TypeScript and 127/127 generated pages. The baseline-data and middleware-convention notices remain non-blocking inherited warnings.

## 2026-08-02 — Recuperación de actividad sin recarga y un único loader

`NovoActivitySurface` reintenta SSE/polling sin recargar la página ni perder el estado del run. `NovoLoopCard` eliminó el spinner duplicado mientras la superficie de actividad ya informa la fase real. Los tests de actividad/Loop pasan 6/6 y ESLint focalizado PASS.

## 2026-08-02 — Catálogo MCP sin capacidades falsas o no confirmadas

Se retiraron del catálogo MCP `delete_task`, `create_calendar_event`, `create_routine`, `generate_day_plan` y `run_twin_agent`. Antes unas devolvían un error aunque se anunciaban y otras podían mutar fuera del Loop confirmado. El E2E aislado verifica que no se enumeran y conserva toda la prueba de scopes, ownership, auditoría e idempotencia: 5/5 PASS en 53.5 s. Lint focalizado PASS.

## 2026-08-02 — Bypass de ejecución cognitiva cerrado

`POST /api/ai/execute` rechazaba acciones cognitivas heredadas sin pasar por una confirmación persistida. Ahora bloquea `UPDATE_COGNITIVE_STATE` y `COGNITIVE_PIPELINE` con `409 ConfirmationRequired`; el usuario debe usar el Novo Loop confirmado. `app/api/ai/execute/route.test.ts` prueba ambas variantes y que el ejecutor no se invoca (2/2 PASS). ESLint focalizado PASS.

## 2026-08-02 — Resumen compartible reclasificado

`components/cognitive/share-cognitive-card.tsx` ya no muestra ni copia un porcentaje de â€œriesgo de fatigaâ€. El contenido se limita a contexto de planificación, estilo de trabajo, ventana preferida y carga operativa estimada, con etiqueta localizada. ESLint focalizado, pruebas de superficie relevantes (4/4) y TypeScript estricto PASS.

## 2026-08-02 — Gates de validación actuales

- `npm run lint`: PASS, 0 errores y 6 warnings heredados.
- `npm test -- --runInBand`: PASS, 53 suites / 175 tests / 2 snapshots / 0 fallos.
- `npx prisma validate`: PASS. `npm run db:migrate:test`: PASS sobre `novo-e2e-test`, 22 migraciones y ninguna pendiente.
- `NODE_OPTIONS=--max-old-space-size=4096 npm run build`: PASS en 9m26s; compilación, TypeScript y 127/127 páginas. Los avisos baseline y deprecación de middleware son deuda existente, no fallos del build.
- No se desplegó: quedan superficies legacy por cerrar antes de declarar el milestone listo.

## 2026-08-02 — Ejecutor autónomo heredado desactivado

`lib/cognitive/twin-agent.ts` ya no ejecuta capacidades automáticas que podían crear tareas/rutinas, reprogramar trabajo, escribir Calendar o enviar Slack a partir de heurísticas no verificadas. `process-twin-signal.ts` limpia los compuestos legacy de carga/fatiga/burnout antes de persistir el Twin y evita registrar sus alertas como aprendizaje. Las acciones mutables permanecen en el Novo Loop con confirmación e idempotencia. `twin-agent-safety.test.ts` verifica que, incluso con valores heredados extremos, no se creen ni actualicen tareas/rutinas (1/1 PASS). ESLint focalizado y TypeScript estricto PASS.

## 2026-08-02 — Objetivo explícito en el plan generado

`components/cognitive/novo-loop-card.tsx` ahora conserva el identificador del objetivo que el usuario acaba de crear y lo envía como `goalId` al endpoint de planificación. Antes el objetivo se persistía pero el planificador podía seleccionar otro objetivo activo por defecto. La prueba de interfaz `novo-loop-card.test.tsx` verifica esa vinculación, además de razones estructuradas y confianza: 3/3 PASS. ESLint focalizado PASS.

## 2026-08-02 — Revalidación aislada MCP y Loop

- `npm run test:db:guard` aceptó únicamente `novo-e2e-test` (`productionOverlap=false`) sin exponer secretos.
- `npm run test:e2e:isolated` aprobó 1 suite / 5 pruebas / 0 fallos en 50.8 s. Cubre objetivo→check-in→plan→actividad→aceptación→inicio→completado→feedback→plan adaptado; propiedad A/B; eventos duplicados/fuera de orden; cancelación idempotente; exclusión de señales; Calendar concurrente idempotente; token hash/revocado/expirado; scopes; checklist manual; auditoría y analítica MCP.
- Jest emitió su aviso genérico de cierre un segundo después de finalizar. No hubo fallo de prueba; el seguimiento de handles se mantiene como comprobación separada de higiene del runner.

## 2026-08-02 — Legacy telemetry reclassified

`lib/cognitive-engine.ts` no longer emits fatigue/reduced-capacity phases from time, curves, or internal workload. `components/settings/settings-twin.tsx` presents the remaining values as non-biometric operational indicators in the active language. Focused engine/presentation tests pass 8/8; no deployment was made.

## 2026-08-02 — Regla determinista de inactividad

- `lib/cognitive/decision-rules.ts` now elevates an unfinished task after 14 days without an observed update (with a bounded larger weight after 30 days). The associated explanation publishes the task timestamp fact; it does not infer a user state.
- Added a RED/GREEN unit case in `lib/cognitive/__tests__/decision-rules.test.ts`: an inactive medium-priority task outranks a recent low-priority task and exposes the exact inactivity fact.
- Focused verification passed: 1 suite, 8 tests; targeted ESLint passed.

## 2026-08-02 — Revisión manual pública de landing

- Browser automation opened the local unauthenticated `/landing`; the accessibility tree includes the product message, pricing CTA, sign-in, sign-up, reviewer flow, support, terms, privacy and refund links.
- A generic automated-browser user agent received direct HTTP 200 and meaningful server HTML containing the product description, pricing/legal/support links and canonical metadata. This confirms no client-side redirect is required for the local public review route.
- Visual inspection of the viewport confirms the dark Novo landing renders its navigation, hero and visual sculpture. The full-page capture initially came back blank from the automation renderer; the viewport capture was used as the valid visual evidence instead.

## 2026-08-02 — Inferencias cognitivas requieren confirmación

- `app/api/ai/generate/route.ts` no longer auto-executes `UPDATE_COGNITIVE_STATE`, `COGNITIVE_PIPELINE` or a cognitive-automation classification from model output. They now follow the existing visible confirmation-proposal path.
- `app/api/ai/execute/route.ts` no longer logs complete submitted actions/results (which can include private content) and returns a generic safe error rather than the caught error message.
- Targeted ESLint and strict TypeScript passed after this change. This protects the legacy path while the verified Novo Loop remains the source of truth for persisted recommendation outcomes.

## 2026-08-02 — Contexto de IA sin fallback fisiológico ni error crudo

- `lib/ai/context-builder.ts` no convierte la ausencia de snapshot en fatiga `low`; expone `unavailable` y registra solamente una falla genérica de recuperación de contexto.
- `app/api/cognitive/daily-summary/route.ts` and `app/api/cognitive/insight/route.ts` use the same unavailable fallback and no longer print raw caught errors.
- `npm test -- --runInBand tests/safety.test.ts tests/actions.test.ts` passed: 2 suites, 6 tests. Targeted ESLint also passed.
- This is a contained privacy/truthfulness correction. Legacy model-driven cognitive-state updates remain listed for further classification; no unverified value has been promoted as physiological evidence.

## 2026-08-02 — Gates globales actuales

- `npm run lint` completed with exit code 0: 0 errors and 6 pre-existing warnings (two custom-font, three image alt-text, one anonymous Prisma config export).
- `npm test -- --runInBand` completed with exit code 0: 47 suites, 163 tests and 2 snapshots passed. Some test fixtures intentionally emit console diagnostics; none is a failed test.
- Full TypeScript validation completed with exit code 0 in 95.9 seconds.
- `npm run build` initially compiled but exhausted the default Node heap while Next ran its TypeScript worker. A single retry with `NODE_OPTIONS=--max-old-space-size=4096` completed with exit code 0 in 505 seconds: optimized compilation, TypeScript, page-data collection and 127/127 static pages all completed. This is the valid current build gate result.

## 2026-08-02 — Revalidación aislada del Loop y MCP

### Evidence

- `node scripts/validate-test-db.mjs` accepted the isolated `novo-e2e-test` branch with `productionOverlap=false`; no production URL was printed or used.
- `npm run test:e2e:isolated` passed all five real-database flows in 53.13 seconds: feedback adaptation, ownership/event ordering/Calendar idempotency, signal exclusion, device-token revocation/scopes, and MCP task work with durable audit/idempotency.
- The same suite reran with `--detectOpenHandles` and passed all five tests in 51.619 seconds without an open-handle diagnostic. The ordinary Jest post-run warning only appears without diagnostic mode and remains test-runner noise, not proof of a resource leak.

## 2026-08-02 — Operational signals no longer masquerade as biometrics

### Completed work

- `lib/db-biometrics.ts` now returns an explicit unavailable biometric payload when Google Fit is absent; it no longer queries tasks, workouts or analytics to manufacture a stress score.
- `types/biometrics.ts` represents an absent physiological score as `null` and its classification as `unavailable`, rather than a plausible neutral percentage.
- `app/api/ai/cognitive-engine/route.ts` considers recovery effects from biometrics only when a verified Google Fit source has usable sleep or heart-rate data. The AI context now says that biometrics are not connected instead of describing task activity as a biometric estimate.
- `lib/cognitive-context.tsx` no longer injects a default stress score into ambient cognitive presentation. A connected provider may supply a value; otherwise no physiological inference is made.
- `components/cognitive/burnout-risk-meter.tsx` now names the card as an operational workload estimate, uses Spanish risk labels and explains its task/session sources instead of implying a burnout diagnosis.
- `components/cognitive/focus-score-ring.tsx` now identifies its numeric result as an estimated operational index based on tasks and sessions, rather than a direct measurement of focus or mental state.
- `app/api/ai/cognitive-engine/route.ts` no longer supplies fabricated average focus quality (`3`) or productivity (`50`) when a user has no observed history. The report context states that history is absent; the operational index does not receive a fake historical-quality contribution.

### Evidence

- `npm test -- --runInBand lib/__tests__/db-biometrics.test.ts app/api/cognitive/biometrics/route.test.ts tests/cognitive-engine.test.ts` passed: 3 suites, 7 tests, 0 failures.
- `node --max-old-space-size=4096 .\\node_modules\\typescript\\bin\\tsc --noEmit --pretty false --incremental` completed with exit code 0 in 113.6 seconds.
- Targeted ESLint for both visible cognitive metric components completed with exit code 0.
- Targeted ESLint for the cognitive-engine route and `npm test -- --runInBand tests/cognitive-engine.test.ts` completed with exit code 0 (1 suite, 5 tests).
- This closes a false-data source but does not turn operational workload estimates into medical/biometric measurements. Legacy cognitive UI remains under audit.

## 2026-08-02 — Biometric route privacy and truthful failure

### Completed work

- `app/api/cognitive/biometrics/route.ts` no longer logs user IDs, sleep, heart-rate or stress values, and no longer returns raw provider/database exception text.
- A failure response no longer supplies a fabricated neutral stress score; it reports biometric data unavailable instead.

### Evidence

- Added `app/api/cognitive/biometrics/route.test.ts`.
- `npm test -- --runInBand app/api/cognitive/biometrics/route.test.ts` passed: 1 suite, 1 test, 0 failures in 2.693 seconds. It injects a private fallback error and confirms neither it nor a fake stress score reaches the response.

## 2026-08-02 — Remove fabricated biometric fallback values

### Completed work

- `lib/db-biometrics.ts` no longer fabricates sleep duration, sleep stages, heart-rate values or sample counts from task and activity data when Google Fit has no data.
- The fallback now reports these fields as unavailable (`hasData: false`, zero values) and no longer writes a derived fatigue estimate into `UserCognitiveSnapshot`.
- Operational task pressure remains distinct from physiological data; it must not become a durable biometric claim.

### Verification scope

- This removes an identified false-data source. The broader legacy metric audit remains in progress because other old cognitive-engine and chat paths still require classification or retirement.
- Added `lib/__tests__/db-biometrics.test.ts`; `npm test -- --runInBand lib/__tests__/db-biometrics.test.ts` passed: 1 suite, 1 test, 0 failures in 2.127 seconds.
- TypeScript validation after the metric-source change passed: `node --max-old-space-size=4096 .\\node_modules\\typescript\\bin\\tsc --noEmit --pretty false --incremental` completed with exit code 0 in 151 seconds.

## 2026-08-02 — First visible AI content latency

### Completed work

- Added the `ai_first_visible_token` operational event and `recordFirstVisibleActivityContent` helper.
- The chat stream records one latency measurement when the first non-hidden content chunk reaches the response; it stores only `runId` and `latencyMs`, never generated content, prompts or token text.
- Repeated chunks in the same stream cannot duplicate the measurement.

### Evidence

- `app/api/ai/stream/__tests__/twin-mode-gating.test.ts` now streams a synthetic private-content chunk and asserts only the run identifier reaches the telemetry helper.
- Focused chat route verification passed: 1 suite, 7 tests, 0 failures in 2.731 seconds.

## 2026-08-02 — Truthful terminal state for interrupted chat streams

### Completed work

- Fixed `app/api/ai/stream/route.ts`: a provider read/disconnect after the SSE response begins is now persisted as the explicit `failed` activity state with safe code `chat_stream_interrupted`.
- Previously, the catch emitted an interruption message but the `finally` block unconditionally marked the same run `completed`, producing a false operational history and incorrect recovery state.

### Evidence

- Added a stream-reader disconnect case to `app/api/ai/stream/__tests__/twin-mode-gating.test.ts`.
- `npm test -- --runInBand app/api/ai/stream/__tests__/twin-mode-gating.test.ts` passed: 1 suite, 6 tests, 0 failures in 2.063 seconds.

## 2026-08-02 — Prisma schema gate

- `node scripts/run-isolated-db-command.mjs npx prisma validate` completed with exit code 0 using the isolated test environment. Prisma validated `prisma/schema.prisma` successfully.
- Prisma reported an available major-version upgrade; no dependency upgrade was performed because this milestone does not justify a major migration.

## 2026-08-02 — MCP no longer accepts unverified cognitive/biometric percentages

### Completed work

- Removed `update_twin_metrics` from `app/api/mcp/route.ts`. An external MCP client could previously write arbitrary cognitive-load, burnout or energy percentages while merely naming a source; that is neither source-validated nor appropriate for an operational task agent.
- Existing task, objective, recommendation and activity capabilities remain scoped; the change removes only the unverified metric-injection surface.

### Evidence

- The isolated MCP E2E now calls `tools/list` with an authorized read token and asserts that `update_twin_metrics` is absent.
- `npm run test:e2e:isolated` passed: 1 suite, 5 tests, 0 failures in 50.023 seconds.

## 2026-08-02 — Signal exclusion affects the next persisted plan

### Completed work

- Expanded the isolated integration proof with a complete correction/exclusion path: it generates a plan from a task signal, excludes that owned signal through `POST /api/cognitive/loop/signals`, then generates another plan and proves the excluded task is absent.
- The expected follow-up falls back to the known objective-planning action rather than silently reusing the excluded task. This validates both persistence and the decision input filter.

### Evidence

- `npm run test:e2e:isolated` passed: 1 suite, 5 tests, 0 failures in 51.171 seconds.
- The five flows now cover closed-loop learning, ownership/recovery/calendar idempotency, signal exclusion, token hash/revocation, and scoped MCP/audit/idempotency.

## 2026-08-02 — UI: terminal outcomes now require structured reasons

### Completed work

- `components/cognitive/novo-loop-card.tsx` now sends the server's canonical outcome-reason enum directly rather than inferring it from translated display text.
- The UI exposes stable, localized labels but persists only values such as `too_large` and `technical_problem`.
- Abandon and failure controls are unavailable until the user selects a reason, matching the server-side `actionResponseSchema` requirement. This avoids a click that looks successful but returns a generic validation failure.

### Evidence

- Added `components/cognitive/__tests__/novo-loop-card.test.tsx`.
- `npm test -- --runInBand components/cognitive/__tests__/novo-loop-card.test.tsx` passed: 1 suite, 1 test, 0 failures in 7.426 seconds.
- TypeScript validation after the change passed: `node --max-old-space-size=4096 .\\node_modules\\typescript\\bin\\tsc --noEmit --pretty false --incremental` completed with exit code 0 in 156.6 seconds.

## 2026-08-02 — Isolated Novo Loop E2E rerun against the real check-in boundary

### Completed work

- Strengthened `tests/novo-loop-isolated.e2e.ts` so the closed-loop proof now calls `POST /api/cognitive/loop/checkin` instead of inserting a `CognitiveStateSnapshot` directly through Prisma.
- The initial rerun exposed a real test-contract mismatch: the route requires `timezone`; the test now supplies the same required field as `components/cognitive/novo-loop-card.tsx`.
- The successful rerun covers objective → persisted check-in → plan/run/events → accepted/started/completed/helpful lifecycle → adapted following plan, alongside ownership, event sequence recovery, cancellation, duplicate delivery, calendar idempotency, MCP task operations, token revocation/expiration and audit persistence.

### Isolation and results

- `node scripts/validate-test-db.mjs` accepted the declared `novo-e2e-test` target and confirmed no production overlap without printing a connection URL.
- `npm run db:migrate:test` completed against the isolated target only; Prisma reported 22 migrations and no pending migration.
- `npm run test:e2e:isolated` passed: 1 suite, 4 tests, 0 failures in 37.746 seconds.
- The initial normal Jest run printed a generic post-run handle warning. The authoritative rerun with `node scripts/run-isolated-db-command.mjs npx jest --runInBand --detectOpenHandles --testEnvironment node --testRegex tests/novo-loop-isolated\\.e2e\\.ts$` passed: 1 suite, 4 tests, 0 open-handle report, 41.968 seconds.

### Scope note

- This is an isolated synthetic-fixture proof, deliberately not a mutation of a real user's production tasks. It establishes route, persistence, ownership, scopes, idempotency and audit behavior; a separately authorized, non-secret production review is still needed to claim that Codex managed a specific live development task through MCP.

## 2026-08-02 — Regression gate after task-queue and desktop fixes

- `npm run lint` completed with 0 errors and 6 pre-existing warnings (two custom-font warnings in `app/layout.tsx`, three missing image-alt warnings in `app/music/artist/[id]/page.tsx`, and the Prisma config default-export warning).
- `npm test -- --runInBand` passed: 44 suites, 158 tests and 2 snapshots in 44.863 seconds.
- The suite still emits existing test-fixture diagnostics from the context builder and Gemini Live hook; they are not test failures and remain separate cleanup work.

## 2026-08-02 — Twin priority respects the owner

### Completed work

- Corrected `lib/cognitive/task-priority.ts`: a user-selected `high` or `medium` priority is now a floor, never silently downgraded by the Twin.
- Removed the origin-label penalty. A `twin-agent`, `catchup` or `triage` tag is not behavioral evidence and no longer causes a task to be hidden behind a lower priority.
- Deadline proximity and in-progress state can still elevate a task. This keeps the Twin adaptive while ensuring it organizes the user's actual queue rather than favoring or punishing agent-created entries.

### Evidence

- TDD RED: a manually high-priority undated task was reduced to medium and a medium task carrying an agent label was reduced to low.
- TDD GREEN: `npm test -- --runInBand lib/cognitive/__tests__/twin-agent-priority.test.ts lib/cognitive/__tests__/decision-rules.test.ts` passed: 2 suites, 11 tests, 0 failures.

## 2026-08-02 — Desktop wallpaper rendering

### Completed work

- Fixed the selected custom-wallpaper layer in `app/globals.css` so it is painted in the body's own stacking context rather than potentially behind the opaque body background in Chromium desktop.
- The existing pseudo-layer design still keeps the image blur and dimness separate from application content; only its paint ordering changed.

### Evidence

- TDD RED: the stylesheet had no isolated body stacking context, allowing the fixed negative-z wallpaper layers to disappear behind the base background on desktop.
- TDD GREEN: `npm test -- --runInBand app/globals.test.ts` passed: 1 suite, 2 tests, 0 failures. The test verifies both the isolated context and the two wallpaper-layer depths.

## 2026-08-02 — Chat run recovery on unexpected request failures

### Completed work

- `POST /api/ai/stream` now keeps the owned activity-run identity from creation through the outer request boundary.
- If parsing, context assembly or another pre-stream server step fails, the owned run is explicitly finished as `failed` with the safe `chat_request_failed` code before returning HTTP 500.
- The failure record contains no prompt, provider response, stack trace or private user content, so a reload or polling client cannot confuse an abandoned active run with a recoverable one.

### Evidence

- TDD RED: an injected `buildUserContext` failure returned HTTP 500 while no terminal activity state was persisted.
- TDD GREEN: `npm test -- --runInBand app/api/ai/stream/__tests__/twin-mode-gating.test.ts` passed: 1 suite, 5 tests, 0 failures. It includes provider fallback, safe provider failure and unexpected pre-stream failure coverage.

## 2026-08-02 — Stream activity follow-up type gate

- `node --max-old-space-size=4096 .\\node_modules\\typescript\\bin\\tsc --noEmit --pretty false --incremental` passed in 92.9 seconds after the chat activity/error-stream changes.

## 2026-08-02 — Chat request log minimization

### Completed work

- Removed raw user-message, provider-body and exception-object logging from `app/api/ai/stream/route.ts`.
- Retained only bounded operational diagnostics such as intent, selected model, fallback activation and safe failure categories.
- This narrows server logs without changing model routing, tool invocation or streamed output.

### Evidence

- The existing chat route gate was rerun after the change: `npm test -- --runInBand app/api/ai/stream/__tests__/twin-mode-gating.test.ts` passed, 1 suite and 4 tests.

## 2026-08-02 — Chat error-stream recovery identifier

### Completed work

- Both chat error streams now emit the owned `activityRunId` in the standard `meta` SSE frame before their terminal content.
- This allows the existing activity surface to recover the persisted state after a no-provider or provider-unavailable response, instead of leaving the client with an unlinked fallback message.
- Replaced the no-provider response's internal configuration instructions with a calm user-facing availability message.

### Evidence

- TDD RED: the no-provider stream had no `runId` even though it had created and failed an activity run.
- TDD GREEN: `npm test -- --runInBand app/api/ai/stream/__tests__/twin-mode-gating.test.ts` passed: 1 suite, 4 tests, 0 failures.

## 2026-08-02 — Truthful chat provider-failure lifecycle

### Completed work

- Fixed `POST /api/ai/stream` so a terminal multi-provider failure marks the persisted chat `AiActivityRun` as `failed` with a safe `provider_unavailable` or `provider_rate_limited` code.
- Replaced raw upstream-provider error text in both server logs and the streamed user-visible response with a concise safe message.
- The client now receives an explicit terminal activity state rather than an ambiguous active run after an unavailable provider.

### Evidence

- TDD RED: the chat route returned a fallback stream while `finishActivityRun` had not been called for the owned run.
- TDD GREEN: `npm test -- --runInBand app/api/ai/stream/__tests__/twin-mode-gating.test.ts` passed: 1 suite, 3 tests, 0 failures. The test injects a private upstream diagnostic and confirms it is absent from the stream.

## 2026-08-02 — Production build gate

### Results

- `node --max-old-space-size=4096 .\\node_modules\\next\\dist\\bin\\next build --webpack --experimental-build-mode compile` passed in 311.7 seconds.
- `node --max-old-space-size=4096 .\\node_modules\\next\\dist\\bin\\next build --webpack --experimental-build-mode generate` passed in 37.0 seconds and generated 127/127 static pages.
- The build emitted only existing non-blocking notices: stale baseline-browser mapping data and Next's middleware-to-proxy migration notice.

### Scope note

- This is local production compilation/generation evidence. Deployment remains intentionally withheld while the full closed-loop completion audit still has unresolved functional requirements.

## 2026-08-02 — AI action audit sanitization

### Completed work

- `lib/ai/executor.ts` no longer logs action payloads, handler results, user IDs or raw error objects to the server console.
- `AiActionLog.payload` now persists only a bounded sorted list of payload field names, never task titles, note bodies, email addresses or other action values.
- Failure audit records use the safe code `action_execution_failed` instead of a raw exception string. The Prisma field documentation now reflects this data contract; no migration was needed because the column type is unchanged.

### Evidence

- TDD RED: the executor test observed private task title and description stored in the audit payload.
- TDD GREEN: `npm test -- --runInBand lib/ai/__tests__/executor.test.ts` passed: 1 suite, 13 tests, 0 failures.
- Follow-up gates: TypeScript passed after the OAuth retry propagation correction; lint passed with 0 errors and the same 6 pre-existing warnings.

## 2026-08-02 — OAuth log minimization

### Completed work

- Removed import-time environment/provider diagnostics from `lib/auth.ts`; importing auth no longer reports which credential variables exist.
- Removed redirect callback logs that could record OAuth authorization-code query parameters.
- Replaced refresh/account-sync error-object logs with bounded safe error codes; refresh tokens, provider response payloads, user IDs and redirect URLs are no longer logged by this module.

### Evidence

- TDD RED: `npm test -- --runInBand lib/__tests__/auth-import.test.ts` recorded six import-time diagnostics, then separately recorded the OAuth redirect URL containing a test authorization code.
- TDD GREEN: `npm test -- --runInBand lib/__tests__/auth-import.test.ts lib/mcp/__tests__/auth.test.ts` passed: 2 suites, 7 tests, 0 failures.

## 2026-08-02 — Post-change verification gate

### Results

- Full TypeScript check passed: `node --max-old-space-size=4096 .\\node_modules\\typescript\\bin\\tsc --noEmit --pretty false --incremental` (92.8 s).
- Lint passed with 0 errors and 6 pre-existing warnings (custom fonts in `app/layout.tsx`, three image alt warnings in `app/music/artist/[id]/page.tsx`, and one anonymous Prisma config export).
- Isolated Loop E2E passed: `npm run test:e2e:isolated` — 1 suite, 4 tests, 0 failures (44.4 s).
- The same E2E run with `--detectOpenHandles` passed (1 suite, 4 tests, 0 failures, 42.8 s) and emitted no handle diagnostic. The ordinary Jest post-run warning was therefore not reproduced under its diagnostic mode.

### E2E coverage reconfirmed

- objective → check-in → generated plan → lifecycle → feedback → adapted next plan;
- ownership, event ordering/duplicates and Calendar idempotency;
- hashed revocable MCP token ownership/scopes;
- MCP task execution, durable audit and mutation idempotency.

### Test-environment noise

- The E2E output still logs absent OAuth configuration from the isolated environment. These are not credentials and no provider call is attempted; the tests pass using the safe local path. The import-time logs should be removed in a separate configuration-hygiene change.

## 2026-08-02 — Cognitive dashboard terminology correction

### Completed work

- Replaced the dashboard widget's `Burnout` diagnosis label with `Carga operativa estimada` and equivalent translated wording.
- The existing numeric input remains explicitly framed as an operational estimate derived from workload signals, not a medical or biometric assessment.
- Kept the underlying persisted field untouched to avoid a destructive schema/API rename while the broader metric audit remains underway.

### Evidence

- TDD RED: `npm test -- --runInBand components/cognitive/__tests__/cognitive-engine-widget.test.tsx` failed because the rendered Spanish widget exposed `Agotamiento`.
- TDD GREEN: the same command passed: 1 suite, 1 test, 0 failures.

### Remaining risk

- Legacy modules outside this dashboard still contain fatigue/burnout terminology and need a separate, evidence-led classification/removal pass. They are not validated medical signals and must not be promoted as such.

## 2026-08-02 — Structured terminal outcome contract

### Completed work

- Tightened `actionResponseSchema` so `abandoned` and `failed` actions require one of the fixed outcome reasons before the server accepts the transition.
- The requirement is enforced at the API validation boundary shared by the Novo Loop and MCP response path; it cannot be bypassed by omitting the UI selector.
- This preserves useful, bounded learning signals without treating free-text notes as a required data source.

### Evidence

- TDD RED: `npm test -- --runInBand lib/schemas/__tests__/cognitive-loop.test.ts` failed because abandonment without `reason` was accepted.
- TDD GREEN: `npm test -- --runInBand lib/schemas/__tests__/cognitive-loop.test.ts lib/cognitive/__tests__/action-state-machine.test.ts` passed: 2 suites, 6 tests, 0 failures.

### Files changed

- `lib/schemas/cognitive-loop.ts`
- `lib/schemas/__tests__/cognitive-loop.test.ts`

## 2026-08-02 — MCP transport boundary hardening

### Completed work

- Added a bounded request preparation boundary in `lib/mcp/request-guard.ts` before the MCP SDK consumes a POST body.
- The 64 KiB payload ceiling now applies even if an automated client omits `Content-Length`; the route rebuilds the bounded request before handing it to the SDK.
- Explicitly rejected JSON-RPC batch payloads. Novo MCP serves one request per HTTP call, preventing a single accepted HTTP request from dispatching multiple tool calls.
- Kept the existing token/user rate limits, scopes, ownership filters and mutation idempotency unchanged.

### Evidence

- TDD RED: `npm test -- --runInBand lib/mcp/__tests__/request-guard.test.ts` failed because the guard module did not exist.
- TDD GREEN: `npm test -- --runInBand lib/mcp/__tests__/request-guard.test.ts lib/mcp/__tests__/auth.test.ts` passed: 2 suites, 7 tests, 0 failures.
- `node --max-old-space-size=4096 .\\node_modules\\typescript\\bin\\tsc --noEmit --pretty false --incremental` exceeded this command runner's 120-second limit without reporting a TypeScript error; it must be rerun in the final validation gate.

### Remaining limitation

- This prevents oversized and multi-tool HTTP payloads, but is not cancellation of an already-started database or external operation. A generic `Promise.race` timeout would be misleading because it could return a timeout while the mutation still commits. Real execution cancellation remains an explicit production-readiness gap until tool work is made abort-aware/durable.

## 2026-07-31 — Baseline and sprite diagnosis

### Completed work

- Read the current validation report and the Proof & Presence specification.
- Confirmed the sprite uses a single shared component, `components/ui/novo-sprite-loader.tsx`; it has no mobile-only animation branch.
- Verified the deployed desktop browser's computed style at `https://productivitynovo.vercel.app/`: `matchMedia('(prefers-reduced-motion: reduce)')` is `true`, and the corresponding rule in `app/globals.css` intentionally applies `animation: none` to `.novo-sprite-sheet`.
- This explains the desktop-static/mobile-animated difference without inventing a CSS breakpoint defect. The static frame is the accessibility-preserving behavior for a desktop/browser configured to reduce motion.

### Files inspected

- `components/ui/novo-sprite-loader.tsx`
- `app/globals.css`
- `app/client-layout.tsx`
- `docs/novo-system-validation.md`
- `tests/actions.test.ts`
- `.env.test.local` (keys only; no secrets read or recorded)

### Commands and evidence

- Browser computed-style inspection: desktop viewport 1280×720, `animation-name: none`, `animation-duration: 0s`, `prefers-reduced-motion: reduce` true.
- `rg` found exactly one currently skipped test: `tests/actions.test.ts`; it requires a live LLM and is unrelated to the deterministic Novo Loop. Equivalent action-execution coverage exists in `lib/ai/__tests__/executor.test.ts`.

### Remaining risks / next work

- There is no `DATABASE_URL_TEST`/`TEST_DATABASE_URL` configured. The existing `.env.test.local` deliberately has no database URL, so an isolated full-loop database test cannot yet run safely. The test harness must reject `DATABASE_URL` and require an explicitly configured test-only endpoint/schema before exercising persistence.
- Proceed with a safe isolated-database test harness, then the operational UI, signal-ledger persistence, metric audit, instrumentation, and only then visual polishing.

## 2026-07-31 — Operational-state UI foundation

### Completed work

- Extended `components/cognitive/novo-loop-card.tsx` so controls follow the persisted recommendation state machine instead of always showing invalid transitions.
- Added controls for starting, completing, postponing, abandoning and failing accepted/started actions, plus intrusive feedback after terminal outcomes.
- Added the calm stale-accepted verification prompt using `staleActions` returned by `GET /api/cognitive/loop/plan`.
- Added the structured abandonment/failure reason list before transition, persisted through the existing response note boundary.
- Repaired the activity-contract test's overly narrow phase type so the repository type-check now covers terminal phase events correctly.

### Files changed

- `components/cognitive/novo-loop-card.tsx`
- `lib/ai/__tests__/activity-contract.test.ts`

### Commands and results

- `node --max-old-space-size=4096 ./node_modules/typescript/bin/tsc --noEmit --pretty false --incremental` — passed.
- `npm test -- --runInBand lib/cognitive/__tests__/action-state-machine.test.ts lib/ai/__tests__/activity-contract.test.ts` — 2 suites, 4 tests passed.
- `npm run lint` — 0 errors, 6 existing warnings.

### Remaining risks

- The abandoned/failed reason is currently stored as safe response-note text. A later source-ledger migration should convert the fixed reason taxonomy to a first-class structured field for analysis without retaining unnecessary free text.

## 2026-07-31 — Signal correction and exclusion foundation

### Completed work

- Added the additive `NovoSignalLedger` persistence model and migration `20260731110000_add_novo_signal_ledger`.
- Added `lib/cognitive/signal-ledger.ts`, which creates a stable hash from source/ref/type and upserts only a concise, safe evidence summary.
- Added owned `GET`/`POST /api/cognitive/loop/signals` operations for correction, exclusion and restoration.
- Integrated excluded task and goal signals into `POST /api/cognitive/loop/plan`; excluded signals are omitted before deterministic scoring and their count is recorded in the plan inputs.

### Files changed

- `prisma/schema.prisma`
- `prisma/migrations/20260731110000_add_novo_signal_ledger/migration.sql`
- `lib/cognitive/signal-ledger.ts`
- `app/api/cognitive/loop/signals/route.ts`
- `app/api/cognitive/loop/plan/route.ts`

### Commands and results

- `npx prisma generate` — passed.
- `node --max-old-space-size=4096 ./node_modules/typescript/bin/tsc --noEmit --pretty false --incremental` — passed.
- Focused deterministic/activity tests — 2 suites, 8 tests passed.

### Remaining risks

- The ledger migration has not been applied or deployed yet; it must be validated against the production build before promotion.
- The current explanation card still needs a UI for correction/exclusion and a source-level reliability label. The persistence and planner boundary are now ready for it.

## 2026-07-31 — Synthetic metric audit (in progress)

### Completed work

- Located every active use of the legacy `42` Twin-confidence bootstrap in onboarding, context initialization, the Twin creation helper, Inngest signal processing and demo creation.
- Replaced the bootstrap value in the owned Twin creation/onboarding paths with `0`, which is explicitly rendered as an uncalibrated state rather than a percentage.
- Replaced random cognitive-graph initial radius generation with a stable hash of the node identifier in `components/cognitive/cognitive-graph-view.tsx`; identical data now starts from identical geometry after reload.

### Remaining risks

- Additional Twin confidence displays need the same uncalibrated label instead of a numeric fallback.
- The broader product still has estimates and model inferences that require visible provenance labels; this is an audit in progress, not a claim that all metrics are now calibrated.

## 2026-07-31 — Isolated E2E database safety gate

### Evidence

- Command: guarded connection-identity check for `DATABASE_URL` and `DATABASE_URL_TEST`.
- Result: `DATABASE_URL_TEST is not configured in this shell.` No migration, reset, schema change, fixture or query was issued after that guard failed.
- The separately supplied candidate connection identifies a database named `Novo – Music System`; it does not include the required `novo-e2e-test`, `test`, or `e2e` identifier. It is therefore rejected as an E2E target even if it becomes injected later.

### Safe next action

- Provide/inject a distinct `DATABASE_URL_TEST` whose database or branch is explicitly named `novo-e2e-test`, `test`, or `e2e`. The next run will compare sanitized host/database/fingerprint against production again before using it.

## 2026-07-31 — Signal provenance and metric truthfulness

### Completed work

- Added additive `NovoSignalSourcePreference` persistence and migration `20260731120000_add_novo_signal_source_preferences`. A source opt-out is deliberately independent from an individual correction, so future observations cannot silently restore an excluded source.
- Extended owned signal APIs with source-level exclude/restore. The planner applies both individual exclusions and source exclusions before deterministic scoring, and persists their counts with each plan.
- Added `components/cognitive/signal-ledger-controls.tsx` to the live Loop explanation: it displays provenance/reliability, correction, individual exclusion/restoration and source-wide exclusion without deleting evidence.
- Replaced the dashboard's numeric 42% Twin fallback with an explicit uncalibrated state. The cognitive metric strip now identifies deterministic estimates, observed-signal confidence and uncalibrated values instead of presenting all numbers as measurements.

### Files changed

- `prisma/schema.prisma`
- `prisma/migrations/20260731120000_add_novo_signal_source_preferences/migration.sql`
- `app/api/cognitive/loop/signals/route.ts`
- `app/api/cognitive/loop/plan/route.ts`
- `components/cognitive/signal-ledger-controls.tsx`
- `components/cognitive/novo-loop-card.tsx`
- `components/dashboard/now-hero.tsx`
- `components/cognitive/cognitive-metrics-strip.tsx`
- `lib/cognitive/events.ts`
- `lib/cognitive/__tests__/signal-ledger.test.ts`

### Commands and results

- `npx prisma generate` completed before the combined type check.
- `node --max-old-space-size=4096 ./node_modules/typescript/bin/tsc --noEmit --pretty false --incremental` passed (274.8 seconds).
- `npm run lint` passed with zero errors and six pre-existing warnings (two font-loading, three missing image alt attributes, one anonymous Prisma config export).
- `npm test -- --runInBand` passed: 32 suites, 125 tests, 1 skipped, 2 snapshots. Existing console noise from missing Spotify test credentials and fallback-context tests remains non-failing.
- `npx prisma validate` passed.
- `npm run build` exceeded the local 300-second command ceiling without compiler output (sanitized command timeout). This is not a successful build result and blocks deployment under the milestone gate; it needs either a longer local build window or isolated CI/Vercel validation after E2E passes.

### Remaining risks

- The new migration and real cross-user correction/exclusion flow still require the isolated test database gate. No database was migrated or changed in this phase.
- The cognitive route no longer turns the deterministic `burnoutRisk` estimate into a "Synaptic Fatigue" protocol, overlay or recovery redirect; its low-focus state remains a non-clinical planning presentation. `TwinCommandCenter` also no longer derives recovery messaging from that estimate, and uncalibrated Twin confidence is shown as an em dash. A follow-up audit is still needed for legacy share-copy wording and other non-Loop cognitive widgets.
- A final `npm run lint` pass after this change remained green with the same six pre-existing warnings.
- Added a global guard in `lib/cognitive-context.tsx`: legacy time-of-day/habit-cost states `SYNAPTIC_FATIGUE` and `REDUCED_CAPACITY_MODE` are normalized to `LINEAR_EXECUTION` before state publication. They can no longer dim Calendar or Projects, set the blue-light filter, start ambient audio, trigger fatigue alerts, or create navigation warnings. This preserves the legacy algorithm as a non-authoritative local estimate while preventing it from making product-wide claims or automated UI changes.
- Extracted that rule to `lib/cognitive/presentation-state.ts` and added `lib/cognitive/__tests__/presentation-state.test.ts`. Focused test passed: 1 suite, 3 tests. It explicitly proves both legacy states cannot reach global presentation state.

## 2026-07-31 — Removed skipped action gate test

- Replaced the former skipped live-provider action test in `tests/actions.test.ts` with a provider-boundary mock. It runs Novo's real classifier, context path and runner, then proves a parsed `CREATE_TASK` action returns as `PROPOSAL` with `requiresConfirmation: true` before the executor can receive it.
- `npm test -- --runInBand tests/actions.test.ts` passed: 1 suite, 5 tests, 0 skipped. The test output retains existing non-failing context fallback and missing Spotify credential console noise; neither is used to assert the confirmation gate.
- Full Jest verification after removing the skipped action test passed: 32 suites, 126 tests, 0 skipped, 2 snapshots.

## 2026-07-31 — Safe activity instrumentation

- Added privacy-safe telemetry in `lib/ai/activity.ts`: `ai_run_started`, first persisted activity event, approved tool start, confirmation requested, and explicit completed/failed/cancelled terminal runs with elapsed duration.
- Telemetry contains only run ID, surface, phase, sanitized allowed tool name and duration. It never writes prompts, streamed text, source content, tool arguments, credentials or errors beyond the existing safe error code path.
- `lib/cognitive/events.ts` centralizes these event names alongside existing Loop lifecycle events. Type-check passed after implementation.

## 2026-07-31 — Activity surface accessibility correction

- Updated `components/ai/novo-activity-surface.tsx` so failed and cancelled runs no longer render the success checkmark. The component now has distinct honest terminal icons.
- The active loader uses `motion-reduce:animate-none`; status updates are announced politely at the label level rather than making the full detail timeline a live region.
- This applies the installed Apple design guidance: reduced motion retains state feedback without continuous spatial/rotational motion. Lint passed with zero errors and the same six pre-existing warnings.

## 2026-07-31 — Real recommendation modification

- `modified` no longer only changes a status. `NovoLoopCard` opens an editable next-step field; `POST /api/cognitive/loop/response` validates and persists the bounded replacement before transitioning to `modified`.
- The contract test in `lib/schemas/__tests__/cognitive-loop.test.ts` passed (2 tests): valid replacements pass; blank replacements are rejected before persistence.

## 2026-07-31 — Corrections affect deterministic planning

- `POST /api/cognitive/loop/plan` now reads both excluded and corrected ledger signals. An included corrected objective/task label replaces the original label before deterministic scoring; an excluded signal or excluded source still has priority and cannot enter the candidate set.
- Plan inputs now count only genuinely excluded signals, not corrections. Type-check passed after this correction.

## 2026-07-31 — Reusable isolated database guard

- Added `scripts/validate-test-db.mjs` and `npm run test:db:guard`. Before any migration, cleanup, fixture or E2E command, it requires both connection variables, compares sanitized host/database/fingerprint identities, rejects overlap with production and requires `novo-e2e-test`, `test` or `e2e` in the test database identity.
- The guard performs no database connection. Its current execution stopped before any connection because `DATABASE_URL_TEST` is absent. This is the one recorded missing-environment result; do not repeat it until the environment changes.

## 2026-07-31 — Neon branch evidence and desktop sprite diagnosis

- The supplied Neon console screenshot identifies the isolated branch as `novo-e2e-test` with database `neondb`. The URL alone does not encode the branch, so the guard now accepts explicit, non-secret `DATABASE_TEST_BRANCH` evidence while still requiring a different connection fingerprint from production. It does not print connection URLs.
- The environment check was rerun with sanitized output and returned `SAFE_GATE: MISSING_DATABASE_URL_TEST`. No migration, reset, seed, truncation or E2E command was executed.
- The desktop sprite issue is explained by the existing accessibility rule in `app/globals.css`: `@media (prefers-reduced-motion: reduce)` sets `.novo-sprite-sheet { animation: none; }`. The in-app desktop browser reports reduced motion enabled (`animationName: none`, `animationDuration: 0s`), while the mobile viewport does not. This is why the sprite animates on mobile but remains on its final frame; it is not a sprite-sheet or frame-positioning failure.
- A synthetic, non-connecting guard self-test passed with equal host/database but different fingerprints plus `DATABASE_TEST_BRANCH=novo-e2e-test`, proving the branch evidence path does not weaken the production-overlap check.

## 2026-07-31 — Full local regression rerun

- `npm test -- --runInBand` passed: 34 suites, 131 tests, 0 skipped, 2 snapshots. Existing console noise about absent Spotify credentials and mocked context fallbacks remains non-failing and is not used as proof of database behavior.
- `npx prisma validate` and `npm run lint` remain green; lint reports the same six pre-existing warnings.
- Connected `.novo-sprite-sheet` to the app-level `data-animations="false"` preference in `app/globals.css`. The OS-level `prefers-reduced-motion` rule remains authoritative, so enabling app animations cannot override an accessibility request.
- `npm run build` first hit Node's default heap limit during TypeScript (exit 134); rerunning with `NODE_OPTIONS=--max-old-space-size=8192` completed successfully: webpack compilation, TypeScript, 155 static pages and route optimization all passed. The only output was non-failing cache/baseline warnings.
- Updated the English/Spanish animation-setting descriptions in `lib/i18n.ts` to explain that system reduced motion takes priority, preventing the desktop behavior from appearing unexplained.
- Final environment audit found no `DATABASE_URL_TEST`, Neon, E2E or alternate test-database variable in the process; repository env files contain only `DATABASE_URL`. No database command was attempted.

## 2026-07-31 — Isolated database command wiring

- Added `lib/database-url.ts` and made `lib/prisma.ts` resolve `DATABASE_URL_TEST` only when `NOVO_ISOLATED_E2E=true`; missing or production-equal test URLs fail closed.
- Added the same guard to `prisma.config.ts` and `scripts/run-isolated-db-command.mjs`; `npm run db:migrate:test` sets `NODE_ENV=test` and the isolated flag only in its child process before invoking Prisma.
- The migration wrapper also requires non-secret `DATABASE_TEST_BRANCH` evidence matching `novo-e2e-test`, `test` or `e2e`, because Neon branch identity is not encoded in the URL.
- Added `lib/__tests__/database-url.test.ts` (3 cases, 6 assertions) covering test selection, overlap rejection and normal development fallback. Focused tests passed: 2 suites, 6 tests.
- The configured shell still does not expose `DATABASE_URL_TEST`, so the migration wrapper stopped at its guard before invoking Prisma. No database command ran.
- After the wiring change, `node --max-old-space-size=4096 ./node_modules/typescript/bin/tsc --noEmit --pretty false --incremental` passed, `npm run lint -- --quiet` passed, and the focused database URL test passed (1 suite, 3 tests).

## 2026-07-31 — Isolated Neon proof completed

- `.env.test.local` was loaded explicitly with dotenv by the guard and isolated command wrapper. Presence checks confirmed `DATABASE_URL_TEST`, `ALLOW_TEST_DB_RESET` and `NODE_ENV` without printing values. The branch marker was `novo-e2e-test`; sanitized host/database/fingerprint comparison confirmed no production overlap.
- The isolated branch was reset only through the guarded wrapper, all 18 migrations applied, and the current Prisma schema was reconciled there with `db push --accept-data-loss` after historical migrations exposed baseline drift. No production URL was used for these operations. The migration defects were limited to historical references to unavailable tables/columns and were made conditional or corrected to the current `User` table.
- `npm run test:e2e:isolated` passed: 1 suite, 2 tests. Evidence covers synthetic users A/B, objective → check-in → plan, persisted activity phases, accept → start → complete → helpful feedback, learned 20-minute sizing in the next plan, sequence recovery, duplicate/out-of-order events, ownership isolation and Calendar idempotency (one pre-existing external execution is returned as a duplicate).
- The E2E process emits non-failing OAuth-credential warnings because provider credentials are intentionally absent in the isolated test environment. No real provider call is made; Calendar behavior is tested at the idempotent persistence boundary.
- Added `GET /api/ai/activity/runs` with strict owner scoping and wired `NovoLoopCard` to rehydrate the latest active Novo run after a reload. The isolated E2E exercises this recovery path for user A and verifies user B receives no run; final rerun passed 1 suite / 2 tests.
- Post-change `npm run lint -- --quiet` passed. A post-change production build was started with an 8 GiB Node heap but exceeded the local 240-second command ceiling without a compiler error; the previously completed production build remains the last successful build evidence. No deployment was made from this unverified build.

## 2026-07-31 — Requirement gap audit

- Added a conservative requirement matrix to `docs/novo-system-validation.md`. It distinguishes proven database behavior from implemented-but-untested cancellation, forced SSE-failure fallback, provider retry and client reconnect telemetry. This prevents the report from overstating completion.
- Extended the isolated E2E with stale-cursor recovery, cancellation and retry terminal runs, plus two concurrent Calendar requests using one idempotency key. Final rerun passed 1 suite / 2 tests.
- Fixed the lifecycle test environment by passing a synthetic key to the mocked Gemini session; no provider credential is used. Repository-wide Jest now passes: 36 suites, 135 tests, 0 skipped, 2 snapshots. The output still contains expected missing-provider and mocked-context console noise.
- Added `components/ai/__tests__/novo-activity-surface.test.tsx`, which forces an EventSource error and verifies the owner-scoped polling recovery request and terminal UI state.
- Production build and deployment completed through Vercel after the green gates. Vercel compiled TypeScript, generated all 155 static pages and created the production deployment. Runtime verification at `productivitynovo.vercel.app/cognitive` found one loaded sprite and `prefers-reduced-motion: true`; the desktop static frame is therefore expected.
- Recorded the production sprite evidence: desktop preloader present, `prefers-reduced-motion` true, computed animation disabled; mobile does not enable that preference. The static desktop frame is intentional accessibility behavior.
## 2026-08-01 â€” Public review-access verification

- Added canonical `/landing` metadata, public robots rules and sitemap entries.
- Added crawlable landing links to sign-in, sign-up, onboarding/reviewer flow, support, terms, privacy and refunds.
- Traced the blank first response to the client-layout hydration placeholder. A pathname-forwarding middleware plus a server-layout branch now serves `/landing` without auth or client redirects while preserving the normal authenticated `/` shell.
- Deployed and aliased the verified production deployment to `https://productivitynovo.vercel.app`.
- Generic-user-agent/raw HTML check: `/landing` HTTP 200, meaningful product HTML, canonical metadata, no loading placeholder; `/robots.txt` and `/sitemap.xml` HTTP 200. Root `/` was separately recorded as HTTP 200 with no `Location` header in the current runtime despite the source-level unauthenticated redirect, which remains an auth/session configuration follow-up.

## 2026-08-01 — Verification refresh, confidence bootstrap and sprite proof

- Reran `npx prisma validate`, quiet lint, TypeScript no-emit and the full Jest suite: all passed; Jest reports 36 suites / 135 tests / 2 snapshots.
- Restored the required non-secret `DATABASE_TEST_BRANCH=novo-e2e-test` marker in private `.env.test.local`. The guard accepted only the isolated branch and confirmed no production overlap using sanitized identity/fingerprint output.
- Added migration `20260801120000_remove_uncalibrated_twin_bootstrap`: schema default is now `0`, and only legacy 42-score twins that are uninitialized with zero signals are corrected. A first test-only migration attempt used the Prisma model name rather than the physical table name; it failed before changing data, was explicitly marked rolled back on the isolated branch, corrected to `cognitive_twin_records`, and then deployed successfully. No production connection was used.
- Reran `npm run test:e2e:isolated` after the migration: 1 suite / 2 tests passed. The existing non-failing OAuth warnings and Jest open-handle notice remain documented.
- Reproduced the desktop sprite state in production: element present; `prefers-reduced-motion: reduce` is true; computed animation is `none` / `0s`; app-level animation setting is not disabled. The desktop static final frame follows the accessibility rule in `app/globals.css`. Mobile does not request reduced motion, so the 1.12-second sprite cycle animates. No code should override this OS/browser preference.
## 2026-08-01 — Device MCP tokens and onboarding completion guard

- Added the additive `McpPersonalAccessToken` model and test-only migration `20260801133000_add_mcp_personal_access_tokens`. The isolated guard accepted `novo-e2e-test`; the migration was applied there only. Token records store an HMAC digest, prefix, scopes, expiry, revocation and sanitized last-use metadata — never the raw bearer token.
- Added authenticated `/settings/mcp`, owner-scoped token issue/list/revoke routes, and Bearer-token verification in the existing Streamable HTTP MCP route. Tokens default to `tasks:read`; task mutation requires explicit opt-in to `tasks:write`. `get_pending_tasks` returns concise unfinished-task data while existing task tools remain scope-gated.
- The isolated E2E now passes 3 tests and proves token validation, owner isolation during revocation and that the raw token is not persisted. Its OAuth-provider warnings and final Jest open-handle notice are non-failing test-environment noise.
- Fixed the onboarding re-entry defect: `initializeTwin` now awaits a server persistence acknowledgement (with one retry) before `/onboarding` navigates to `/today`. A failed acknowledgement leaves the user on the final screen with a localized, retryable error instead of creating a local-only completion that the server cannot recognize on the next login.

## 2026-08-01 — Production MCP recovery

- Production migration status revealed an earlier failed `20260731110000_add_novo_signal_ledger` attempt. Read-only inspection confirmed the failure was a stale `users` table reference and no ledger/preference/MCP tables existed, so no partial schema had to be removed.
- The failed attempt was marked rolled back with `prisma migrate resolve`; `prisma migrate deploy` then applied the corrected ledger migration, source-preference migration, confidence-bootstrap migration and MCP personal-token migration. No reset, truncation or production data deletion was used.
- A signed-in browser created a read-only `Codex` device token successfully. A sanitized Streamable HTTP MCP verification confirmed `tools/list` exposes 14 tools including `get_pending_tasks`; the pending-task call returned HTTP 200 and one owned pending task. The token secret was not recorded in this document.
- The Settings control center now renders MCP as an internal tab and the Advanced card switches to that tab rather than navigating away from the floating Settings dialog. The client handles non-JSON responses safely; the API returns safe JSON 503 responses for token-service failures.

## 2026-08-01 — MCP functional/security gate on isolated Neon

- Added additive migration `20260801150000_add_mcp_audit_logs` and applied it only through `npm run db:migrate:test` after the existing test-branch guard accepted `novo-e2e-test`. The durable audit stores actor/client, owner, tool/action, affected resource, request/idempotency identifiers, status and safe summaries; it stores neither bearer tokens nor request bodies.
- `app/api/mcp/route.ts` now gives device tokens explicit `tasks`, `goals`, `recommendations` and activity scopes, requires UUID idempotency keys for task mutation, records each read/mutation, rate-limits per client and owner, caps request size, and blocks deletion and Calendar writes from MCP because a client-provided boolean is not human confirmation.
- `tests/novo-loop-isolated.e2e.ts` now proves four database-backed flows: the full Loop with adaptation, ownership/recovery/Calendar idempotency, token hashing/revocation, and MCP objective read + write-scope denial + create/start/complete + recommendation outcome persistence + audit persistence + duplicate suppression + expired/invalid token rejection. Latest result: 1 suite, 4 tests passed (37.7 s). OAuth warnings and Jest’s post-run open-handle notice are non-failing test-environment noise.
- Deferred the AI day-plan generator import until its privileged MCP tool is actually invoked. Reading tasks/objectives no longer requires an AI provider key, as shown by the isolated MCP route test.

## 2026-08-01 — Explicit stale-recommendation resolution

- Updated `lib/cognitive/action-state-machine.ts` and `components/cognitive/novo-loop-card.tsx`: stale accepted recommendations now ask what actually happened and expose started, completed, postponed, abandoned, failed and “no longer relevant” actions. The last option persists a valid `dismissed` transition instead of inventing a result. Focused state-machine tests pass.
## 2026-08-01 — MCP observability refresh and metric boundary audit

- Extended the privacy-safe analytics contract with `mcp_tool_invoked` and `mcp_tool_completed`. `lib/mcp/audit.ts` emits only tool/action/resource type, sanitized client identifier and safe result code; it never adds bearer values, task bodies or request arguments. Analytics failures are intentionally non-blocking so an observability outage cannot duplicate or prevent an audited MCP mutation.
- The isolated MCP E2E now asserts these two event classes in addition to durable `McpAuditLog` records. The guarded test database migration reports no pending migrations and the E2E passes 1 suite / 4 tests in 36.1 seconds after an initial sandbox-only Neon connectivity failure was retried with approved network access.
- A repository metric search found legacy cognitive/fatigue surfaces outside the verified Novo Loop (`lib/cognitive-engine.ts`, `lib/cognitive-context.tsx`, legacy chat cards and plugin heuristics). They are deterministic or decorative estimates, not biometric or clinical measurements, but several still use unsafe medical-sounding copy. The current Loop presentation guard remains the supported operational surface; the legacy surfaces are documented as a production-readiness copy debt rather than being silently represented as verified measurements.
## 2026-08-01 — Production MCP handoff and verified deployment

- Using the owner-provided device credential (not recorded here), production MCP returned HTTP 200 for `tools/list`; after the new deployment the public alias exposes 18 tools, including `start_task`, while deletion remains guarded behind Novo confirmation.
- MCP returned one real pending task. The authorized agent updated that task to `in-progress`; a subsequent MCP read after deployment confirmed the same owner-scoped task and state persisted. The task is intentionally not marked complete because its requested context-switching work is separate from this infrastructure milestone.
- Applied `20260801150000_add_mcp_audit_logs` to production with `npx prisma migrate deploy`; no reset, truncation or destructive operation was used. Published deployment `novo-desktop-9zlb9y7jp.vercel.app` and explicitly aliased `productivitynovo.vercel.app` to it. Public MCP verification returned HTTP 200 with the new tool surface.
- The owner should rotate/revoke the credential after this session because it was pasted into chat. The application stores only its digest; this document contains no token value.
## 2026-08-01 — Final production publication after metric copy guard

- Re-ran `npm run lint -- --quiet` and `npm run build`; both passed after the final Hub/presentation and metric-copy changes. The Vercel build generated 127 static pages and all application/API routes successfully.
- Published `novo-desktop-7p5bs3uem.vercel.app` and explicitly aliased `productivitynovo.vercel.app` to it. Final owner-authorized MCP smoke check returned HTTP 200, 18 tools, `start_task=true` and the deletion confirmation guard present.
- The final live call to `start_task` returned HTTP 200 with the real task still `in-progress`; this records the handoff through the new durable MCP audit boundary without falsely claiming completion.
## 2026-08-01 — Structured outcome reasons and learning feedback

- Added a server-validated `reason` enum to `actionResponseSchema`. The Loop UI now normalizes its localized reason labels into stable codes; the response route persists the code in `OutcomeEvent.metadata.reason` and uses it as `RecommendedAction.terminalReason` while retaining optional user notes separately.
- The deterministic planner now reads recent abandoned/failed outcomes and adapts action size when the user reported `too_large` or `lack_of_time`; a focused test proves the same task becomes a 15-minute step after the prior outcome.
- Focused validation passed: 2 suites, 9 tests. TypeScript no-emit passed after the change. A full production build/deploy is still required before this feedback change can be considered live.
## 2026-08-01 — Adaptive outcome feedback published

- Full Jest validation after structured reasons: 37 suites, 139 tests, 2 snapshots, 0 failures. Isolated E2E: 1 suite, 4 tests passed; expected missing-provider warnings and Jest open-handle notice remain non-failing test-environment noise.
- Final lint and production build passed. Vercel published `novo-desktop-7laex3hk6.vercel.app`; `productivitynovo.vercel.app` was explicitly aliased to it. A live MCP smoke check returned HTTP 200, 18 tools and `start_task`.
- The next-plan rules now consume persisted structured `too_large`/`lack_of_time` outcomes and reduce the next action size. No additional schema migration was needed because outcome metadata is already JSON-backed.
## 2026-08-02 — Checklist MCP y gate de producción

- Se consultó el checklist real mediante `/api/mcp` con autorización del propietario. El único registro devuelto está en estado `in-progress`: tarea del Twin Agent para retomar `context_switching`; no se marcó como completada porque no existe evidencia de que el trabajo funcional haya terminado.
- E2E aislado: verde, 4/4 tests; unit tests: 37 suites, 139 tests, 2 snapshots; TypeScript: verde; lint: 0 errores y 6 warnings preexistentes.
- Se añadió `McpSecurityEvent` y el registro de rechazos de autorización; migración aplicada únicamente a la base aislada. La migración de producción permanece pendiente hasta completar el build.
- El build de producción se ejecutó dos veces y no produjo salida ni terminó dentro del gate operativo; se detuvo el worker huérfano para evitar procesos persistentes. No se desplegó ni se aplicó la migración a producción bajo esta condición.
- Corrección de aprendizaje transversal: `lib/cognitive/twin-agent.ts` ahora lee hasta 50 tareas existentes del usuario (manuales, importadas y del agente), calcula una prioridad determinista usando prioridad declarada, fecha límite, estado y etiquetas, y actualiza `scheduledReason`; los caminos de bloqueo y triage reorganizan la cola existente en lugar de crear duplicados. Test: `twin-agent-priority.test.ts`, 3/3.
- Prueba MCP de tarea real: `update_task` con idempotency key devolvió HTTP 200; `read_tasks(status=all)` confirmó el mismo registro persistido como `done`. La implementación que lo respalda quedó validada por el test adaptativo; no se marcaron tareas manuales no realizadas.
- Gate de build: se detectó y corrigió un error real de Next (`use server` no permite exportar una función síncrona). La utilidad de prioridad se movió a `lib/cognitive/task-priority.ts`; TypeScript volvió a pasar y `twin-agent-priority.test.ts` pasó 3/3. El build completo continúa excediendo 10 minutos sin código de salida, por lo que producción permanece intacta.
- Corrección de cobertura de checklist: el MCP y el Twin ahora incluyen `ChecklistItem` además de `Task`. `get_pending_tasks` devuelve recursos normalizados con `resourceType`, ordenados por prioridad, y el E2E aislado prueba que el usuario A ve su tarea manual mientras que la de B no se filtra. Resultado: 4/4 E2E y TypeScript verde.
- Producción: migración `20260801170000_add_mcp_security_events` aplicada; despliegue `novo-desktop-eugz4ygy0` asignado a `productivitynovo.vercel.app`. Verificación: `/landing` HTTP 200 con canonical; MCP HTTP 200. Consulta publicada de tareas pendientes devolvió 5 recursos de checklist y 0 tareas standalone, sin exponer títulos ni contenido privado.
- Gates finales: Prisma validate PASS; lint 0 errores/6 warnings heredados; unit PASS 38 suites/142 tests/2 snapshots; E2E aislado PASS 4/4; Next compile y generate PASS; build remoto Vercel PASS.

## 2026-08-02 — Operación segura del checklist manual

- Se amplió `app/api/mcp/route.ts` con `update_checklist_item`. La herramienta acepta el identificador normalizado devuelto por `get_pending_tasks`, exige `tasks:write` e idempotency key UUID, retiene el filtro de propiedad y deja un `McpAuditLog` con `resourceType=checklist_item`. No permite eliminación ni acciones externas.
- TDD: el E2E aislado se modificó primero para exigir que un usuario pueda completar/priorizar su propio checklist, que el mismo idempotency key devuelva duplicado y que no pueda modificar un ítem de otro usuario. Falló contra la herramienta inexistente y pasó después de la implementación: 1 suite, 4/4 tests, 40.5 s.
- Revalidación actual: TypeScript PASS; lint PASS con 0 errores/6 warnings heredados; unit PASS (39 suites, 143 tests, 2 snapshots); Next `compile` PASS (2.0 min) y `generate` PASS (127/127 páginas). El primer `npm run build` agotó el timeout y dejó workers propios; se identificaron y terminaron antes de ejecutar las dos fases limpias.
- La ruta demo de Twin ahora devuelve 410 en vez de destruir datos existentes y sembrar 30 días sintéticos. El onboarding y el estado inicial exponen métricas sin calibrar como tales (cero/desconocido), no como una confianza 42 o una inferencia biomédica. Tests focalizados: 2 suites, 4/4.
- No se marcaron como completadas las tareas manuales del usuario sin evidencia de ejecución. La siguiente acción en producción será desplegar esta herramienta y priorizar/actualizar solo las tareas cuyo trabajo real esté verificado.

## 2026-08-02 — Checklist real de Novo actualizado mediante MCP

- Vercel publicó `novo-desktop-8209fukb7.vercel.app` y `productivitynovo.vercel.app` se asignó explícitamente a ese despliegue. El build remoto completó TypeScript y 127 páginas estáticas.
- La verificación autorizada de producción respondió HTTP 200 por Streamable HTTP/SSE: `update_checklist_item` está presente; el inventario inicial fue 5 checklist items y 0 `Task` standalone.
- Se completó mediante MCP el ítem real de auditoría después de concluir el trabajo documentado. La respuesta confirmó `completed=true` y la consulta posterior devolvió 4 pendientes, sin el ítem de auditoría. La mutación usa un idempotency key y queda en el ledger de auditoría; ni el bearer ni los títulos se registran aquí.
- Los cuatro ítems restantes quedan abiertos: requieren correcciones/producto específicos y no se han marcado por inferencia. El token compartido en la conversación debe revocarse o rotarse una vez termine esta sesión.
- Aplicando la prioridad declarada por el usuario y la evidencia disponible, el MCP elevó el fallo visible de wallpaper de PC a `high` y redujo la mejora de gráficos sin una especificación/librería confirmada a `low`. Las demás permanecen en `medium`; ninguna se completa por esa organización.

## 2026-08-02 — Corrección de métricas inventadas en el chat

- La rama de actualización cognitiva en `components/ai/modern-chatbot/context.tsx` fabricaba `focusScore=75`, `burnoutRisk=35` y capacidad media/baja cuando no llegaban datos. Se reemplazó por ausencia explícita.
- `components/ai/modern-chatbot/blocks/cognitive-update-card.tsx` ahora muestra `Sin datos` para las tres columnas sin evidencia. Conserva métricas sólo cuando la respuesta aporta un valor.
- TDD: el test nuevo falló contra los valores `0`/`unknown` antes del cambio y pasó después. Validación posterior: 1 suite/1 test PASS y TypeScript PASS.
- Gates de publicación: lint 0 errores/6 warnings heredados; unit 40 suites/144 tests/2 snapshots PASS; E2E aislado 1 suite/4 tests PASS; Next compile y generate PASS (127 páginas); Vercel publicó `novo-desktop-mqbndb8jz.vercel.app` y el alias `productivitynovo.vercel.app` fue actualizado explícitamente.

## VerificaciÃ³n de build y E2E posterior (2026-08-02)

- El control de intensidad de las tarjetas fue conectado a los tres niveles de Liquid Glass. `app/globals.test.ts` cubre la escala efectiva de `--card-blur-px`; la prueba fallÃ³ antes de usar la variable y pasÃ³ despuÃ©s.
- La publicaciÃ³n posterior pasÃ³ el build remoto de Vercel y `productivitynovo.vercel.app` fue reasignado al despliegue actual. Localmente, el build monolÃ­tico agotÃ³ heap/tiempo, pero las fases oficiales `next build --experimental-build-mode compile` y `generate` con heap ampliado pasaron; generate completÃ³ 127/127 pÃ¡ginas.
- `npm run test:e2e:isolated` y su repeticiÃ³n con `--detectOpenHandles` pasaron 4/4 contra la base aislada. El diagnÃ³stico no reportÃ³ handles abiertos. Los avisos de credenciales OAuth ausentes pertenecen al entorno de prueba y no cambian el resultado del loop.
- Brecha MCP confirmada, no cerrada: `app/api/mcp/route.ts` aplica lÃ­mites por token/usuario y payload, pero no tiene timeout cancelable ni un presupuesto de llamadas por run. El transporte MCP instalado no expone cancelaciÃ³n de `handleRequest`; un `Promise.race` no serÃ­a una correcciÃ³n segura porque una mutaciÃ³n podrÃ­a continuar tras responder timeout.

## 2026-08-02 — Revalidación posterior a la corrección de métricas y prioridades

- Validación local completa: `npm run lint` terminó con 0 errores y 6 advertencias heredadas; `npm test -- --runInBand` terminó con 47 suites / 164 tests / 2 snapshots aprobados; el `tsc --noEmit` estricto aprobó. Los diagnósticos de consola de fixtures no son fallos y no contienen secretos de producción.
- `NODE_OPTIONS=--max-old-space-size=4096 npm run build` terminó correctamente tras 12m27s: compilación, TypeScript, generación de 127/127 páginas y trazas. El heap ampliado sigue siendo necesario en esta estación de trabajo; no se confundió el límite de memoria previo con un fallo de código.
- Las decisiones ahora consideran inactividad observada de la tarea (sin actualización por 14+ días), junto a plazo/prioridad declarada, y citan ese hecho en la explicación. El test de reglas prueba que una tarea media inactiva supera una baja reciente. Esto es una señal operativa, no una métrica cognitiva.
- No se desplegó esta revalidación: el worktree contiene cambios ajenos y aún existen brechas de producto documentadas (normalización de conflictos/dependencias, prueba de proveedor externo real y auditoría final de superficies cognitivas heredadas).

## 2026-08-02 — Retiro de alertas de fatiga no verificadas

- `hooks/use-peak-task-orchestrator.ts` dejó de convertir el payload heredado de patrones en alertas proactivas de burnout. La aplicación ya no emite esos avisos por una puntuación obtenida indirectamente de productividad.
- `app/api/cognitive/patterns/route.ts` ya no deriva `fatigueHistory` de `DailyAnalytics` y rechaza `fatigue_sample` con `410 DeprecatedSignal`; por tanto no vuelve a escribir productividad/fatiga del snapshot desde una cifra arbitraria del cliente. El check-in del Loop continúa siendo la entrada operativa soportada.
- Pruebas focalizadas: `app/api/cognitive/patterns/route.test.ts` (2) y `lib/cognitive/__tests__/presentation-state.test.ts` (3), 5/5 PASS. Lint de los archivos modificados y TypeScript estricto PASS.
- Esta corrección no convierte las superficies antiguas restantes en métricas verificadas: sus campos deben seguir etiquetándose como estimación operativa o no mostrarse hasta que tengan fuente y consentimiento explícitos.

## 2026-08-02 — Bloqueo de planificación automática por fase horaria

- `hooks/use-peak-task-orchestrator.ts` podía llamar a `/api/onboarding/day-plan` y crear un plan cuando una fase de “peak focus” estimada no encontraba tareas. Se cambió a un aviso informativo sin mutación: una fase horaria no es autorización para crear trabajo ni sustituye objetivo → check-in → propuesta → respuesta del Novo Loop.
- La cola de tareas reales de alta prioridad sigue estando disponible como sugerencia con una acción explícita del usuario. La ruta de recuperación permanece sin activación global gracias a la normalización de presentación anterior.
- Se saneó el log de fallo del generador legado. Lint focalizado y TypeScript estricto PASS.

## 2026-08-02 — Cierre de escritura de insights clínicos heredados

- `app/api/cognitive/insight/route.ts` ya no acepta tipos `fatigue` ni `burnout`. Esa ruta no posee un ledger de fuente ni el consentimiento/check-in necesario para registrar una afirmación de ese tipo.
- `app/api/cognitive/insight/route.test.ts` prueba que un payload de fatiga autenticado devuelve 400 y no crea un insight ni actualiza el snapshot. Junto con la frontera de patrones: 2 suites / 3 tests PASS; lint focalizado PASS.

## 2026-08-02 — Revalidación E2E aislada del Loop

- `scripts/validate-test-db.mjs` aceptó exclusivamente la rama `novo-e2e-test`, con `productionOverlap=false`; no se imprimieron credenciales ni se operó sobre producción.
- `npm run test:e2e:isolated` aprobó 1 suite / 5 tests en 53.1 s: loop objetivo→check-in→plan→ciclo de vida→feedback→plan adaptado, ownership/orden/duplicados/Calendar, exclusión de señales, token revocable y trabajo MCP auditado/idempotente.
- La repetición con `--detectOpenHandles` aprobó los mismos 5/5 en 49.4 s y no informó handles abiertos. El aviso de la corrida normal pertenece al cierre genérico de Jest, no a un diagnóstico reproducido.
- `npx prisma validate` PASS. Tras pasar el mismo guard, `npm run db:migrate:test` encontró 22 migraciones y ninguna pendiente; la única datasource de migración efectiva fue la rama aislada.

## 2026-08-02 — Confianza explicable en el Loop

- `components/cognitive/novo-loop-card.tsx` ahora muestra confianza Alta/Media/Baja en vez de una precisión numérica engañosa y explica su límite según el valor determinista de la recomendación. Los hechos, la inferencia y la acción permanecen separados.
- `novo-loop-card.test.tsx` comprueba la presentación Media y su limitación, además del motivo estructurado previo: 2/2 PASS. Lint focalizado PASS.

## 2026-08-02 — Recuperación ordenada de actividad

- `NovoActivitySurface` ya no descarta un evento SSE que llegue después de uno con secuencia mayor. Conserva el cursor máximo para recuperación y fusiona/ordena todos los eventos por secuencia, como exige el contrato compartido.
- Se reemplazó el spinner continuo por una señal de radio con pulso reducido, respetando `prefers-reduced-motion`; los terminales siguen transformándose en iconos de resultado.
- Tests de actividad: 2 suites / 4 tests PASS, incluyendo SSE→polling y la secuencia 2→1 renderizada como 1→2. Lint focalizado PASS.

## 2026-08-02 — Cancelación terminal idempotente

- `finishActivityRun` devuelve el run terminal perteneciente al usuario cuando se repite la misma cancelación, en vez de crear otro evento o exponer un falso 404.
- El E2E aislado prueba dos cancelaciones sobre el mismo run y confirma un único evento terminal. El suite completo del Loop permanece 5/5 PASS contra `novo-e2e-test`.

## 2026-08-02 — Saneamiento de generación IA

- `app/api/ai/generate/route.ts` dejó de registrar bodies, razonamiento del clasificador, contenido de salida que no pudo parsearse y objetos de error crudos. El metadata de conversación tampoco devuelve el razonamiento interno del router.
- El fallo externo devuelve ahora sólo `InternalError` y copy seguro. `app/api/ai/generate/route.test.ts` prueba que una solicitud JSON malformada no refleja su detalle privado: 1/1 PASS; lint focalizado PASS.

## 2026-08-02 — Saneamiento del comando Gemini heredado

- `app/api/ai/command/route.ts` dejó de registrar mensajes, respuestas, argumentos de herramientas, objetos de error y stacks. Conserva sólo eventos operativos con el nombre de una función declarada cuando realmente se ejecuta.
- La ruta responde errores genéricos sin stack. `app/api/ai/command/route.test.ts` prueba la respuesta ante JSON malformado; junto con generate: 2 suites / 2 tests PASS y lint focalizado PASS.

## 2026-08-02 — Confirmación para funciones del comando heredado

- El endpoint legado `/api/ai/command` ya no ejecuta funciones seleccionadas por Gemini. Como no dispone de una tarjeta de confirmación ni de idempotencia de escritura, ahora devuelve una propuesta con `requiresConfirmation=true` y no expone argumentos de la función.
- Test: una respuesta del proveedor que solicita `create_task` devuelve confirmación requerida y `executeFunctionCall` no se invoca. `command/route.test.ts` 2/2 PASS, lint focalizado y TypeScript estricto PASS.

## 2026-08-02 — Saneamiento de búsqueda web

- `app/api/ai/web-search/route.ts` ya no registra la consulta, URL, respuesta del proveedor ni texto de errores. La indisponibilidad de proveedor responde `SearchUnavailable` sin revelar configuración.
- `web-search/route.test.ts` 1/1 PASS verifica que no retorna el nombre de la variable de entorno. Lint focalizado y TypeScript estricto PASS.

## 2026-08-02 — Gate global posterior a endurecimiento de IA

- `npm run lint` PASS con 0 errores y 6 warnings heredados; `npm test -- --runInBand` PASS con 51 suites / 171 tests / 2 snapshots; TypeScript estricto PASS. Los avisos de consola proceden de fixtures de fallo, OAuth de prueba y un `act(...)` heredado; no son fallos de los gates.
- `NODE_OPTIONS=--max-old-space-size=4096 npm run build` PASS en 11m18s: compilación, TypeScript, 127/127 páginas estáticas y trazas. Los avisos de baseline/middleware son deuda técnica heredada; no hubo errores de build.
# Latest continuation — shadcn, Thinking Orb y paquete comercial (2026-08-03)

Revalidación posterior: `app/globals.test.ts` 3/3; nuevo despliegue Vercel `novo-desktop-6apkjuw9b.vercel.app`, alias `productivitynovo.vercel.app`, `/landing` y `/terms` HTTP 200.

- `components.json` ya validaba una configuración shadcn existente (`new-york`, aliases `@/*`, CSS variables, Lucide); no se ejecutó `init` destructivo.
- Se instaló `thinking-orbs@0.2.0` (MIT, React >=18) y se inspeccionaron sus exports reales.
- Se creó `components/ai/novo-thinking-orb.tsx`, con mapping central de fases reales, reduced motion, preferencia `data-animations`, fallback terminal y estado de reconexión.
- `NovoActivitySurface` ahora usa el wrapper compartido en Novo Loop y chat, sin cambiar el contrato SSE ni inventar fases.
- Tests focalizados: 6/6 (orb + wallpaper/blur).
- Lemon Squeezy: las cinco variables necesarias están presentes en `.env.local` sin registrar valores; `tests/lemonsqueezy-checkout.test.ts` pasa 1/1.
- Se creó `docs/raylight-saas-explainer-production.md` con guion, escenas, copy comercial, reglas de captura y checklist de publicación. Raylight no está disponible como CLI/integración local, por lo que el render final aún no está probado.
- Vercel produjo `https://novo-desktop-bgweh1v4q.vercel.app`; el alias `https://productivitynovo.vercel.app` fue actualizado. Build remoto: PASS, 127/127 rutas.
- Canario HTTP: `/landing` 200 (HTML SSR), `/terms` 200, `/api/mcp` 401 sin autorización.
- Checklist real consultado previamente por MCP: quedan 1 ítem, Bklit UI. No se marcó como completado porque `bklit-ui` no existe como paquete React; la variante encontrada es Vue 3.
# Visual reference pass — 2026-08-03

- Se incorporó una capa ambiental reutilizable en `[data-app-viewport]`: ruido dither SVG de baja opacidad y gradientes verde/teal que derivan lentamente con `novo-ambient-drift`.
- Las superficies Radix de diálogo comparten ahora textura y profundidad ambiental mediante `::before/::after`, sin mover contenido ni introducir lógica de negocio.
- El apilado fue asegurado con `isolation` y z-index explícitos; controles y texto permanecen por encima de los efectos.
- `prefers-reduced-motion` desactiva la deriva continua.
- Verificación focalizada: `npx jest app/globals.test.ts components/ai/__tests__/novo-thinking-orb.test.tsx --runInBand` → 2 suites, 6 tests OK.
- La referencia se aplicó a partir de las capturas proporcionadas; la automatización de `/browse` no pudo iniciar su daemon en este entorno.
- Despliegue verificado: `https://novo-desktop-9zr0eo2f0.vercel.app` (build remoto OK, 127 rutas) y alias `https://productivitynovo.vercel.app` actualizado. Comprobaciones directas: `/landing` HTTP 200 y `/terms` HTTP 200.
- Segunda publicación visual: `https://novo-desktop-lo7161kq2.vercel.app`; alias `productivitynovo.vercel.app` actualizado nuevamente. Build remoto OK (127 rutas) y `/landing` HTTP 200.
- Tercera publicación visual: `https://novo-desktop-9z7xof8gs.vercel.app`; alias `productivitynovo.vercel.app` actualizado. Incluye la navegación premium de Ajustes, transición entre pestañas, integración de pendientes del checklist en Ahora y el nuevo posicionamiento de notificaciones. Build remoto OK (127 rutas) y `/landing` HTTP 200.
- Cuarta publicación visual: `https://novo-desktop-msc453htc.vercel.app`; extendí noise sutil a todas las tarjetas compartidas `.liquid-glass`/`.liquid-glass-subtle` para unificar dashboards, listas y módulos. Build remoto OK (127 rutas); alias actualizado y `/landing` HTTP 200.
- Quinta publicación visual: `https://novo-desktop-dppy5hs3y.vercel.app`; Ajustes ahora usa rail lateral premium en escritorio y cápsula horizontal en móvil, manteniendo la misma navegación y estado. Build remoto OK (127 rutas); alias actualizado y `/landing` HTTP 200.
- Sexta publicación visual: `https://novo-desktop-jficjjzgj.vercel.app`; eliminé violetas heredados de primitives compartidos (estado vacío y focus ring) para usar el acento primario de Novo. Build remoto OK (127 rutas); alias actualizado y `/landing` HTTP 200.
- Séptima publicación visual: `https://novo-desktop-10bo4cu34.vercel.app`; el gradiente de `.novo-premium-field` ahora deriva continuamente en 18 s, con fallback estático para `prefers-reduced-motion`. Build remoto OK (127 rutas); alias actualizado y `/landing` HTTP 200.
# Cognitive Twin flagship milestone audit (2026-08-03)

- Added `docs/novo-cognitive-twin-audit.md`, `docs/cognitive-twin-design-research.md`, `docs/cognitive-graph-architecture.md`, `docs/cognitive-twin-adaptive-policy.md` and `docs/cognitive-page-qa.md`.
- Current evidence: Cognitive consumes persisted engine data and has loop APIs for plans, outcomes and signal correction; the page is still statistics-first and the existing graph lacks lenses, inspector, alternative view and contextual focus.
- Mobbin MCP was not available in the active tool/skill set. Public references were used and the seven Mobbin queries remain explicitly listed for a later repeat.
- No UI implementation was started in this audit pass. Design approval is required before changing the Cognitive surface.
# Cognitive Center follow-up — 2026-08-03

- Added typed bounded graph contract in `lib/cognitive-graph/types.ts` with explicit lenses, evidence reliability, inference flags and correction state.
- Added deterministic layout/lens/evidence helpers and unit coverage in `lib/cognitive-graph/{layout,lenses,evidence}.ts` and `lib/cognitive-graph/__tests__/graph-contract.test.ts`.
- Added `buildCognitiveGraphSnapshot` projection from Prisma-owned records; the graph route now returns it alongside the legacy graph shape for compatibility.
- Added `components/cognitive/cognitive-command-surface.tsx` and mounted it in `app/cognitive/page.tsx`; it exposes attention, rationale, facts vs inference, inspector, lens switching and signal exclusion.
- Focused ESLint and 3 graph contract tests pass. Global type-check remains pending because it exceeded the five-minute execution window without diagnostics.
# Strategic kernel evidence — 2026-08-04

## Remote Preview and information architecture gate — 2026-08-04

- The remote Vercel Preview gate is green at `novo-desktop-nfl0d0ksk.vercel.app`; its build generated 128/128 pages and completed serverless function tracing.
- The provider import-time crash was removed without weakening runtime credential validation. Missing OpenRouter credentials now produce an operational request error rather than a build-time crash.
- Activity has a stable deep link (`/activity`) that reconstructs the latest owner-scoped Novo Loop run through the existing activity protocol. Chat has a stable `/chat` entry alias.
- Public review evidence: `/landing` is directly server-rendered with pricing, support, terms, privacy and refunds links; canonical metadata points to `https://productivitynovo.vercel.app/landing`.
- Responsive browser evidence is stored in `docs/preview-routes-mobile.png`, `docs/preview-routes-tablet.png` and `docs/preview-routes-desktop.png`.
- Production canary completed after promotion: `https://productivitynovo.vercel.app/landing` returned HTTP 200 and preserved the canonical URL metadata.

- Added `docs/novo-revolutionary-kernel.md` to freeze scope around the verifiable execution loop and its north-star metric: prioritized actions verified per week.
- Global TypeScript passed after removing generated `.next` artifacts that had exhausted disk space.
- Full lint passed with six pre-existing warnings and no errors.
- Full Jest suite passed: 58 suites, 190 tests and 2 snapshots; the closed-loop/graph subset remains 13/13.
- Production build remains unproven because it exceeded the five-minute gate; no deploy was made.
- Cognitive validation rerun (2026-08-04): `npm test -- --runInBand` PASS (59 suites / 191 tests / 2 snapshots); strict TypeScript PASS; `npm run lint` PASS (0 errors, 6 inherited warnings); Impeccable detector returned `[]` for the new Cognitive surface. The direct production-build diagnostic reached Next's optimized-build phase but exceeded the local resource budget; generated `.next` artifacts and the build child were cleaned, so no deployment or production-readiness claim was made.
- Isolated E2E rerun: `npm run test:e2e:isolated` PASS, 1 suite / 5 tests, using the guarded test database only. The suite covered the persisted Loop lifecycle, ownership, ordering/recovery, signal exclusion, token scopes and external idempotency. The runner emitted its known delayed-exit warning after passing.
- The same isolated E2E with `--detectOpenHandles` also passed 5/5 and reported no open-handle diagnostic.
- After adding bounded blocker/pattern projection, the full suite was rerun: 59 suites / 191 tests / 2 snapshots PASS; strict TypeScript and full lint also PASS (0 errors, 6 inherited warnings).
- Remote production deployment completed: `novo-desktop-o2z5pikl7.vercel.app`, aliased to `productivitynovo.vercel.app`; Vercel reported successful compilation, TypeScript, 127/127 static pages and serverless function generation. Generic automated-browser HTTP canary returned 200 for public policies/landing and the Cognitive shell.
- Latest post-onboarding gate: Jest 60 suites / 192 tests / 2 snapshots PASS; strict TypeScript and full lint PASS. Follow-up deployment `novo-desktop-msrw4yg1s.vercel.app` is the current `productivitynovo.vercel.app` alias.
- Latest performance/reduced-motion gate: Jest 61 suites / 197 tests / 2 snapshots PASS; deterministic layout benchmarks cover 30/100/500/2,000 nodes and the orb pauses under reduced motion.
- Authenticated isolated browser proof initialized a synthetic Twin and reached the real `Centro Cognitivo` surface; desktop/mobile screenshots are stored at `docs/cognitive-authenticated-desktop-2026-08-04.png` and `docs/cognitive-authenticated-mobile-2026-08-04.png`. The guarded graph endpoint returned 200 for a synthetic Pro fixture with persisted nodes. Client hydration remains resource-sensitive in the local dev server, so interactive inspector/lens behavior is retained as an explicit evidence gap rather than overstated.
- Added bounded hydration and graph request timeouts so slow isolated dependencies resolve to a recoverable state instead of an indefinite “Preparando Novo” loader. Redeployed successfully as `novo-desktop-87jeqyes5.vercel.app` and aliased to `productivitynovo.vercel.app`; generic-agent canary returned 200 for landing, policies, robots and the cognitive shell.
- Final deploy after the truthful empty/error state: `novo-desktop-7nnw1wtlt.vercel.app`, aliased to `productivitynovo.vercel.app`; Vercel again completed 127/127 routes.
- Added retry control to the recoverable Cognitive Center error state and redeployed as `novo-desktop-3sov434xs.vercel.app`, aliased to `productivitynovo.vercel.app`.
- Cognitive route hydration isolation shipped: `/cognitive` now avoids the global route transition wrapper, preserving motion elsewhere while allowing its client data effects to mount independently. Deployment `novo-desktop-5e20f0exu.vercel.app` passed the remote production build and is aliased to `productivitynovo.vercel.app`.
- Global widget isolation shipped for `/cognitive`: notification, chat and music floating surfaces remain available elsewhere but no longer compete with the flagship route's hydration. Deployment `novo-desktop-i54g6tgzq.vercel.app` passed the remote build and is aliased to `productivitynovo.vercel.app`.
# Product-truth milestone addendum — 2026-08-04

- Product wedge, surface inventory and freeze decisions: `docs/novo-product-truth.md`.
- Wedge and falsifiers: `docs/novo-wedge-strategy.md`.
- 14-day pilot protocol without invented results: `docs/novo-validation-experiment.md`.
- Canonical activation funnel and current instrumentation gap: `docs/novo-activation-funnel.md`.
- Founder Pro pricing experiment and Lemon Squeezy gates: `docs/novo-pricing-experiment.md`.
- Launch gates and remaining blockers: `docs/novo-launch-readiness.md`.
- Code evidence remains limited to repository/runtime/test results; interviews, cohort outcomes, payments and PMF remain unobserved.
- Final gate cleanup: the only orphaned build tree was identified as the repository's `npm run build` → `next build --webpack` → worker chain, closed without touching the Codex MCP server, and `.next/lock` is now absent. Isolated E2E passed 5/5 in 91.2s. Production build remains blocked by local resource/time behavior (default heap exit 134; 4 GB retry exceeded 10 minutes), so no deploy was made.
