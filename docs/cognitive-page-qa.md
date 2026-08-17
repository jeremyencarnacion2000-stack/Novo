# Cognitive page QA baseline

## Estado actual

- Route: `/cognitive`.
- Auth: authenticated route through `AuthWrapper` and `DashboardShell`.
- Data: `useCognitiveEngineData(chronotype)` and `/api/cognitive/graph`.
- Desktop: header + full scroll surface; graph fixed at 480px in the current layout.
- Mobile: single column with a bounded SVG plus accessible context cards; selecting a node opens a draggable bottom-sheet inspector.
- Reduced motion: the flagship command surface uses static deterministic positions and the shared Sheet/transition primitives honor reduced-motion settings; unrelated legacy cognitive widgets remain documented separately.

## Final validation addendum - 2026-08-04

- Isolated database guard accepted the `novo-e2e-test` branch; no production overlap was detected and no connection secret was written to logs.
- Isolated E2E: 1 suite / 5 tests passed, including objective -> check-in -> plan -> lifecycle -> feedback adaptation, ownership and event ordering, signal exclusion, token scope/revocation, and Calendar/MCP idempotency. `--detectOpenHandles` reported no retained handles.
- Full Jest: 61 suites / 198 tests / 2 snapshots passed. The added Command Center interaction test covers lens switching, node inspection, and signal exclusion. Strict TypeScript and full lint passed (six inherited warnings only). `git diff --check` passed.
- Deterministic layout benchmark passed for 30, 100, 500 and 2,000 nodes; reduced-motion orb test passed.
- Remote Vercel production build completed successfully with 127/127 generated pages. Alias `productivitynovo.vercel.app` points to the successful deployment. Generic user-agent canary returned HTTP 200 for `/landing`, `/robots.txt`, `/terms`, `/privacy`, `/refunds` and `/cognitive`.
- Public mobile reduced-motion evidence is captured in `docs/cognitive-mobile-reduced-2026-08-04.png`; onboarding copy no longer claims biometric or telemetry capabilities.
- Authenticated isolated browser proof reached the real `Centro Cognitivo` surface after synthetic Twin initialization. Screenshots: `docs/cognitive-authenticated-desktop-2026-08-04.png` and `docs/cognitive-authenticated-mobile-2026-08-04.png`. The direct graph API returned HTTP 200 for a synthetic Pro fixture and included persisted graph nodes. The local dev server remained resource-sensitive while client hydration awaited graph data, so interactive inspector/lens screenshots are not claimed as complete browser E2E evidence.
- Remaining evidence gap: a stable authenticated browser run that waits through client hydration and exercises inspector selection, lens changes, correction/exclusion and outcome feedback end-to-end. The underlying route and isolated API/E2E behavior are covered; this is a verification gap, not a claimed feature completion.
- Hydration hardening: `CognitiveTwinProvider` now aborts server hydration after 10 seconds and `CognitiveCommandSurface` reports a bounded fetch failure after 15 seconds, preventing an indefinite authenticated loader when the database or route is slow.
- Production redeploy after this fix: `novo-desktop-87jeqyes5.vercel.app`, explicitly aliased to `productivitynovo.vercel.app`; remote build completed successfully with 127/127 routes. Generic review-agent canary returned HTTP 200 for all public review routes listed above.
- Final regression gates after the hydration fix: full Jest 61/61 suites and 197/197 tests passed; isolated E2E with `--detectOpenHandles` passed 5/5 with no open-handle diagnostic; strict TypeScript and lint remained green.
- Authenticated browser retry now has a bounded, truthful failure surface: when the local dev server skips the client transition before issuing the graph request, the page displays `No se pudo recuperar el contexto cognitivo. Intenta actualizar para reanudar.` instead of blank content or an infinite loader. This confirms recovery UX; interactive graph evidence remains unclaimed because the local dev runtime emitted `Transition was skipped` before the fetch lifecycle.
- Added an explicit `Intentar de nuevo` control to the recoverable error state. Focused component test passed after the change. Final production deploy: `novo-desktop-3sov434xs.vercel.app`, aliased to `productivitynovo.vercel.app`, with 127/127 generated routes.
- Hydration isolation: authenticated `/cognitive` now bypasses the global route `PageTransition` wrapper while preserving it for every other route. This removes the dev-only transition interruption from the flagship surface. Vercel build verified the change in deployment `novo-desktop-5e20f0exu.vercel.app`, aliased to `productivitynovo.vercel.app`; generic canary remains HTTP 200 across all public review routes.
- A local production build attempt remained unavailable because the workstation exhausted disk space (`ENOSPC`); generated `.next` artifacts were cleaned. The remote production build is the authoritative successful build evidence.
- Cognitive Center now also omits the global notification/chat/music widget stack while its route is mounted. This keeps the flagship surface focused and prevents shared motion queues from interrupting hydration. Deployment `novo-desktop-i54g6tgzq.vercel.app` passed 127/127 routes and is the current alias target; public canary remained HTTP 200.
- Mobile inspector refinement: selecting a graph node, attention item, or accessible context card now opens a bottom sheet with the same evidence, relationships, confidence and exclusion controls as desktop. The sheet uses the existing drag-to-dismiss primitive, safe-area padding and reduced-motion-compatible Radix transitions. Lens changes also persist in the URL as `?lens=...` without duplicating the graph model.
- Final mobile inspector deployment: `novo-desktop-qxqsd3nj6.vercel.app`, explicitly aliased to `productivitynovo.vercel.app`. Remote build completed with 127/127 routes; generic review-agent canary returned HTTP 200 for `/landing`, `/robots.txt`, `/terms`, `/privacy`, `/refunds` and `/cognitive`.
- Regression evidence after the mobile inspector change: full Jest 61/61 suites, 198/198 tests and 2 snapshots; focused Command Center interaction test 2/2; strict TypeScript and focused ESLint passed.
- Hydration safety follow-up: URL lens hydration now starts from the server-safe `now` state and applies a URL lens after mount, avoiding an SSR/client selection mismatch. The final deployment is `novo-desktop-dwg4k5aga.vercel.app`, aliased to `productivitynovo.vercel.app`; remote build again completed 127/127 routes and the `/landing`, `/cognitive`, and `/robots.txt` canary returned 200.
- Fresh gstack browser evidence: `/landing` rendered the complete product/pricing/policy/auth link surface with no console errors. An unauthenticated `/cognitive` navigation remained public-safe and did not expose the authenticated surface; importing the installed Chrome profile failed at the OS DPAPI boundary, so no authenticated browser claim is made.
- Focus mode is now wired end-to-end: repeated selection of the same node enters the backend-supported local projection (`focus` query), preserves the URL state, and `Escape` returns to the root context. Final deployment `novo-desktop-1xl8rkqtt.vercel.app` is aliased to `productivitynovo.vercel.app`; Vercel generated 127/127 routes successfully.

## Required acceptance checks for the redesign

1. First viewport has one primary recommendation and visible Why this controls.
2. Recommendation facts map to persisted evidence IDs.
3. Selecting a graph node opens an inspector; keyboard and mobile bottom sheet work.
4. Lens changes reuse one snapshot model and update the URL/state without a duplicate graph implementation.
5. Correction/exclusion calls `/api/cognitive/loop/signals` and the next snapshot visibly changes.
6. Accept/start/complete/helpful updates the loop and the learning timeline.
7. Sparse data and API error preserve truthful empty/error states without invented nodes.
8. Reduced motion disables pulses, camera movement and edge animation.
9. Mobile targets are at least 44px and the alternative list contains every selected relationship in text.
10. `npm run lint`, TypeScript, relevant Jest suites and production build pass.

## Evidence gaps to close

- A stable authenticated browser session still needs to capture the hydrated inspector/lens/correction flow visually. Deterministic component, API and isolated database tests cover the behavior without overstating browser evidence.
- A production screen-reader session and a low-end device trace would strengthen, but are not required to infer correctness from the existing keyboard, reduced-motion and bounded-layout checks.

## Latest validation note (2026-08-04)

- The isolated Loop E2E covers persistence and learning, but there is no browser E2E route through the Cognitive page, inspector, lenses, correction and outcome learning.
- Full Jest (59 suites / 191 tests / 2 snapshots), TypeScript and lint pass. The latest direct production-build diagnostic reached `Creating an optimized production build ...` before the local time/disk budget was exceeded; generated artifacts and orphan build processes were removed. No deployment is claimed from this local run.
- A separate `next build --webpack --experimental-build-mode compile` attempt reproduced the same resource timeout; its generated artifacts and workers were also cleaned.
- The latest full test rerun after the projection refinement remains green: 59 suites / 191 tests / 2 snapshots; TypeScript and lint pass.
- Playwright mobile reduced-motion evidence: 390x844 `/cognitive` returned HTTP 200, rendered the evidence-based onboarding copy, contained no biometric/telemetry promise and no continuous `animate-*` classes. Screenshot captured at `docs/cognitive-mobile-reduced-2026-08-04.png`.
- Final post-onboarding tests: 61 suites / 197 tests / 2 snapshots PASS; strict TypeScript and full lint PASS. Remote Vercel build/deployment is green; local monolithic build remains a workstation resource limitation.
- Performance/reduced-motion unit evidence: deterministic layout tests pass for 30, 100, 500 and 2,000 nodes; `NovoThinkingOrb` pauses when `prefers-reduced-motion` is enabled (8 focused tests PASS).
- An authenticated local browser run was attempted against the guarded test database with a synthetic account. The Webpack dev server did not finish its first route compilation within five minutes, so no authenticated screenshot or behavioral claim was recorded; all spawned processes were terminated.
# Validation snapshot — 2026-08-04

- Focused and full ESLint: passed; existing warnings remain in unrelated font/image files.
- TypeScript: `node --max-old-space-size=4096 ./node_modules/typescript/bin/tsc --noEmit --pretty false --incremental false` passed.
- Full Jest suite: 58 suites, 190 tests and 2 snapshots passed. Focused graph/loop subset remains 13/13.
- Impeccable detector: no findings for the Cognitive page and Command Center surface.
- Production build: attempted four times with 300–600 second windows, including one controlled test with reduced import optimization; each run spawned an actively compiling Next child without a diagnostic and exhausted most free disk in `.next`. The generated artifacts and orphan build children were removed after each attempt. Deployment remains gated on a completed build.
