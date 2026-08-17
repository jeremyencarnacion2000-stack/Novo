# Novo — Phase 1 authenticated recertification

Date: 2026-08-09  
Scope: Phase 1 only. No general Cognitive redesign was performed from archived screenshots.

## Verdict

**Phase 1 evidence gate: PASS.** The current authenticated product was exercised with a synthetic internal account and captured in populated, selected, inspector, fact, inference, correction, learning, loading, and error states.

This is not an operative GO for the complete remediation plan. The isolated E2E gate, the empty-database migration chain, and a production build still have open blockers described below. Phase 2 has not started.

## Audit account contract

- Reserved synthetic user: `audit-phase1-user-reserved` / `audit-phase1@novo.test.invalid`.
- The CLI seed only accepts `NODE_ENV=test`, `NOVO_ISOLATED_E2E=true`, a test/e2e branch marker, a distinct test database identity, and a password supplied at execution time.
- Production Vercel environments and a test URL overlapping the production PostgreSQL identity are rejected.
- The seed is transaction-scoped and idempotent for the reserved identity. It does not read or overwrite a real user.
- The fixture contains goals, tasks, signals, facts, model inferences, patterns, recommendations, outcomes, Activity events, corrections, exclusions, and learning.
- Fresh database verification:

  `AUDIT_PHASE1_VERIFY totalUsers=1 role=user plan=pro onboarding=true validPassword=true wrongPasswordRejected=true accounts=0 mcpTokens=0 integrations=0`

The password and browser session material are intentionally excluded from this report and from repository artifacts.

## Evidence matrix

| Requirement                       | Desktop                                | 390 px                                                                        | Result |
| --------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------- | ------ |
| Dashboard authenticated           | `home-desktop.png`                     | `home-mobile.png`                                                             | PASS   |
| Cognitive populated               | `cognitive-desktop.png`                | `cognitive-mobile.png`                                                        | PASS   |
| Selected node and Inspector       | `cognitive-inspector-desktop.png`      | `cognitive-correction-mobile.png`, `cognitive-correction-controls-mobile.png` | PASS   |
| Fact and model inference          | `cognitive-fact-inference-desktop.png` | `cognitive-fact-inference-mobile.png`                                         | PASS   |
| Correction and exclusion controls | `cognitive-correction-desktop.png`     | `cognitive-correction-controls-mobile.png`                                    | PASS   |
| Learning and navigable graph      | `cognitive-graph-desktop.png`          | `cognitive-graph-mobile.png`                                                  | PASS   |
| Cognitive loading                 | `cognitive-loading-desktop.png`        | `cognitive-loading-mobile.png`                                                | PASS   |
| Cognitive error and retry         | `cognitive-error-desktop.png`          | `cognitive-error-mobile.png`                                                  | PASS   |
| Today real recommendation         | `today-desktop.png`                    | —                                                                             | PASS   |
| Today loading                     | `today-loading-desktop.png`            | —                                                                             | PASS   |
| Chat complete conversation        | `chat-desktop.png`                     | —                                                                             | PASS   |
| Activity action/outcome/learning  | `activity-desktop.png`                 | —                                                                             | PASS   |
| Activity loading/recovery         | `activity-loading-desktop.png`         | —                                                                             | PASS   |

The error capture kept the authenticated database online and rejected only the Cognitive endpoint in the browser harness. The loading capture activated the component's existing initial-loading branch in the mounted current UI. Neither capture required a product source mutation.

## What the current product proves

- Cognitive exposes three identity beliefs backed by **7 consulted evidence items** and **3 explicit inferences**.
- The Twin graph exposes **11 visible learning/adaptation nodes** rather than a static decorative graph.
- The recommendation can disclose separate **facts used** and **Novo interpretation**.
- Inspector exposes meaning, confidence, evidence count, status, last update, decision impact, relationships, source classification, and correction/exclusion controls.
- Activity reaches a persisted final state (`Plan listo`) and exposes the adaptation stage; Chat and Today consume the same seeded operational context.

## Blockers fixed during recertification

1. Local PostgreSQL was incorrectly forced through the Neon transport. Transport selection now keeps Neon for remote Neon URLs and uses the PostgreSQL adapter for loopback/local URLs.
2. Credential sign-in could race the client session and bounce an authenticated user to Landing. Successful credential auth now performs a full document navigation, and the unauthenticated guard probes the server session before redirecting.
3. Selecting a node on desktop mounted the mobile Sheet overlay, dimming the Inspector without exposing a usable sheet. The Sheet now opens only at the mobile breakpoint, covered by desktop and mobile regression tests.

## Open findings

### Release / data blockers

- **P0 — empty-database migration chain:** `prisma migrate deploy` fails at `20260801120000_remove_uncalibrated_twin_bootstrap` with Prisma `P3018` / PostgreSQL `42P01` because the migration references a relation that does not exist on a clean database. The Phase 1 fixture used a disposable local database bootstrapped with `prisma db push`; this does not certify the migration chain.
- **P0 — isolated E2E unavailable:** the configured Neon test-branch credentials rejected authentication. Phase 9 was not run, so operative GO cannot be declared.
- **Release gate open — production build:** the attempted production build did not complete within 15 minutes and produced no `.next/BUILD_ID`. TypeScript and lint pass, but that is not a build pass.

### Current UX / visual findings for later phases

- **P1:** mobile fixed navigation and utilities overlap lower Cognitive/graph content. Phase 2 must establish one primary mobile navigation layer and collapse secondary utilities under sheets.
- **P1:** the light-mode error material has weak red-on-pink contrast and the loading state leaves a large empty canvas. Both states work but need the Phase 2 material/contrast contract.
- Critical UI still mixes English and Spanish (`Your context`, `Cognitive Identity`, Spanish body copy). Phase 3 must unify the critical journey without removing i18n.
- Development-only `Compiling` badges and cold Turbopack latency are visible in some evidence; these are not production UI.
- The Activity Jest suite passes but JSDOM logs a known canvas warning from `thinking-orbs`; the warning is test-environment noise, not a failed assertion.
- During cold development compilation, Activity SSE routes briefly returned 404 and then recovered through polling. This recovery worked, but cold-route behavior remains a performance/integration finding.
- The isolated DB command wrapper forces `NODE_ENV=test`, which is not compatible with running the Next development server. Browser recertification therefore used a direct development process pointed only at the disposable local database.

## Fresh verification

| Check                                     | Result                                                       |
| ----------------------------------------- | ------------------------------------------------------------ |
| Seed contract tests                       | 11/11 PASS                                                   |
| DB/auth/navigation/Cognitive focal suites | 23/23 PASS                                                   |
| Activity UI and contract suites           | 6/6 PASS                                                     |
| TypeScript `tsc --noEmit`                 | PASS (exit 0)                                                |
| ESLint                                    | PASS with 0 errors and 6 pre-existing warnings               |
| Focused `git diff --check`                | PASS                                                         |
| Synthetic account isolation               | PASS: no OAuth accounts, MCP tokens, or integration accounts |

Total fresh assertions: **40 passing tests, 0 failing tests**. Build and full isolated E2E remain open and are not represented as passes.

## Phase boundary

Phase 1 is complete enough to evaluate the current authenticated product. The next authorized work is Phase 2 blocker remediation (wallpaper material contrast, floating overlays, and the legacy Workout surface decision), not a general Cognitive redesign.
