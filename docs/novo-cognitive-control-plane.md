# Novo Cognitive Control Plane — audit and vertical slice plan

## Current architecture

Novo is a Next.js 16 App Router application using React 19, TypeScript, Prisma 5 and PostgreSQL through `@neondatabase/serverless`/`PrismaNeon`. `lib/prisma.ts` keeps a serverless pool per warm process; production must use a Neon pooled connection URL. Authentication is NextAuth JWT with Prisma, credentials, Google and Spotify (`lib/auth.ts`).

Existing operational data includes `Goal`, `Task`, `ChecklistItem`, `FocusSession`, `CalendarEvent`, `AnalyticsEvent`, `CognitiveTwinRecord`, `BehavioralSignal`, `TwinEvolutionLog`, `AICallLog`, `AiActionLog`, and provider accounts. The current cognitive API (`app/api/ai/cognitive-engine/route.ts`) aggregates tasks, focus and Twin data, asks Gemini/Groq for JSON, and falls back to local synthesis. `Today` (`app/today/page.tsx`) is a task aggregator backed by `IntegrationEngine`, so it is the appropriate operating home.

Reusable pieces: NextAuth session/ownership patterns, Zod route validation in newer APIs, `AnalyticsEvent`, calendar aggregation, native `CalendarEvent`, Cognitive Twin signals/logs, task/checklist persistence, and the existing animation/design system.

## Audit findings

### Product and data gaps

- `Goal` is a useful base but lacks explicit priority, success condition and source.
- `UserCognitiveSnapshot` is a single latest record rather than a time-series check-in with source/completeness.
- The cognitive engine has a useful fallback but its LLM JSON is parsed without a full Zod contract and mixes estimates with authoritative-sounding language.
- `Today` displays many task groups; it does not persist a daily plan, primary recommendation, user response, usefulness feedback, or evidence trail.
- `AnalyticsEvent` is generic and can record event names, but the Novo Loop event taxonomy is not normalized.
- Google Calendar read/sync and event creation exist, but creating a proposed focus block needs idempotency and explicit-plan linkage before it can serve as the Loop action.

### Security and privacy risks

- OAuth refresh and configuration paths currently log operational details. New work must log only non-sensitive identifiers/error classes.
- Google service helpers depend on session OAuth state; Loop actions must confirm provider scope and never send tokens to the client.
- Cognitive inferences must distinguish user-reported facts from derived estimates and must not make medical claims.

### Navigation

- `/today` is the task operating view and is the target home.
- `/checklist` is the detailed checklist surface.
- `/analytics` is historical reporting.
- `/cognitive` is Twin/engine inspection.

These are overlapping but not safely redundant; no route is removed in v1.

## Baseline verification (2026-07-30)

- `npm run lint`: passed.
- `npm test -- --runInBand`: pre-existing failures. Jest 30 runtime is incompatible with the installed mocker (`clearMocksOnScope is not a function`) across 10 suites; `platform-signals` mocks lack `twinEvolutionLog.findMany`; the process also reaches its heap limit. 16 suites / 84 tests passed before failure.
- A previous Vercel production build compiled and type-checked successfully. Local global TypeScript checks can exceed the workstation time budget, so production build remains the authoritative final compilation gate.

## Proposed vertical slice — Novo Loop v1

Use `/today` as the operating home. A signed-in user creates or confirms one `Goal`, completes a short check-in (energy, focus, available time, workload and current context), then generates one persisted daily `ActionPlan` with ordered `RecommendedAction` records. A deterministic rule engine selects/suppresses candidates from real goals, tasks, deadlines, postponements and recent outcomes. The optional AI boundary only normalizes an action/explanation into a Zod-validated contract; deterministic constraints can reject it.

The primary card will expose facts, inference, recommendation, confidence and effort, plus Accept, Modify, Postpone, Dismiss, Why this?, completion and helpful/unhelpful actions. Accept creates or links a real `Task`/`ChecklistItem`; every response creates an `OutcomeEvent`. The next plan reads previous outcomes. One optional Google Calendar focus block is proposed only after acceptance, shown before execution, idempotent by action key, and logged.

## Expected files and migration strategy

- Add `CognitiveProfile`, `CognitiveStateSnapshot`, `ActionPlan`, `RecommendedAction`, `OutcomeEvent` and `IntegrationPermission` (or repository-compatible equivalents) plus additive relations/indexes in `prisma/schema.prisma` and a timestamped Prisma migration.
- Extend `Goal` additively with nullable/backfilled metadata rather than replacing it.
- Add `lib/cognitive/` decision rules, Zod contracts and event helpers.
- Add authenticated `/api/cognitive/loop/*` routes with user ownership filters.
- Add a focused Today client component/card and tests under `lib/cognitive/__tests__` and `app/api/cognitive/loop/__tests__`.

Implemented in the current slice: `components/cognitive/novo-loop-card.tsx` and authenticated routes under `app/api/cognitive/loop/` for check-ins, plans, responses and explicitly permissioned Google Calendar focus blocks. The card follows the existing language setting for its supported copy and has no horizontal overflow at a 390px viewport.

Migration: nullable/additive fields first; backfill only safe defaults; deploy schema before depending on it; never infer historic user state as fact. Read pattern per plan: bounded goal/task/signal/outcome queries (about 4–6 reads); writes: one snapshot, plan, 1–3 actions and response events; AI: at most one generation per explicit request/day window, never render-triggered.

## Testing strategy

- Unit: deadline urgency, postponement, inactivity, suppression, confidence, priority and timezone boundaries.
- Integration: ownership, persisted check-in/plan/responses/outcomes, invalid AI response and idempotent calendar action.
- E2E: objective → check-in → Why this → accept → complete → helpful → next plan.
- Manual: unauthenticated, empty, provider-error, mobile and reduced-motion states.

## Explicit non-goals

- No generic chatbot replacement, medical scoring, autonomous external writes, new social/journal/music modules, broad IA rewrite, fake personalization or pricing work.
