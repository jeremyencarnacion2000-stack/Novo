# Twin Mode — Full Twin Context + Premium Chat Switch — Design Spec

## Context

This is the third and last of the three sub-projects decomposed from the
user's original request earlier this session (the other two — landing
redesign, and MCP externo/Active Signal for Calendar+Notion — are both
shipped). Original phrasing: *"para que el chat de novo use el twin y poner
un acceso direccto, y creo que seria mas premium poner un swich en el ia
imput, sobre el rediseño."*

Three parts, investigated separately:

1. **"Que el chat use el twin"** — confirmed gap: `lib/ai/context-builder.ts`
   only feeds the chat `UserSettings`, `UserCognitiveSnapshot`, and (since
   this session's Notion work) `activeSignal`. It never includes the
   `CognitiveTwinRecord` profile (identity, chronotype, peak window, trust
   level, confidence score, main friction point) or the cognitive graph
   (`nodes`/`edges`) shown on `/cognitive`. User confirmed they want **both**
   the flat profile fields and the graph structure.
2. **"Acceso directo"** — already satisfied: `app/cognitive/page.tsx` already
   has a "Chat con el Twin" button routing to `/ai`, added earlier this
   session. No further work.
3. **"Switch premium... sobre el rediseño"** — refers to the chatbot
   redesign direction memory from 2026-06-29 (Zyricon/DeepSeek references,
   which mention "model selector pills" in the input). Clarified as: a
   **"Modo Twin" / "Modo Rápido" switch**, gated to **Pro plan only** — the
   first real monetization hook built this session (existing plan-gating
   only limits monthly AI-action count, per `FREE_PLAN_MONTHLY_ACTION_LIMIT`
   in `lib/ai/executor.ts`).

## Goal

1. Build `buildTwinContextSummary(userId)` — the full Twin profile + graph,
   reusing the exact existing fetch pattern from
   `app/api/cognitive/graph/route.ts` and the already-tested
   `buildCognitiveGraph()` from `lib/cognitive-graph.ts`.
2. Wire it into the chat's context assembly, gated behind a `twinMode` flag.
3. Add a "Modo Twin" / "Modo Rápido" switch to the chat composer — Pro-only,
   defaulting ON for Pro users, locked (shows upgrade prompt) for Free.

## Twin Context + Server-Side Gating

- `lib/cognitive/twin-context.ts` (new): `buildTwinContextSummary(userId):
  Promise<TwinContextSummary | null>`. Fetches `CognitiveTwinRecord`
  (`identity`, `energyCurve`, `metrics`, `bottlenecks`, plus `trustLevel` and
  `confidenceScore` — not currently selected by the `/cognitive/graph` route,
  needed here for the "nivel de confianza" part of the profile), grouped
  `BehavioralSignal` counts (last 30 days), and recent `TwinEvolutionLog`
  change types (last 7 days) — identical query shape to
  `app/api/cognitive/graph/route.ts:14-31`. Calls the existing
  `buildCognitiveGraph(twinRecord, signalCounts, recentChangeTypes)` for the
  graph, and returns `{ profile: {...}, graph: CognitiveGraph }`. Returns
  `null` if no `CognitiveTwinRecord` exists yet (cold-start user).
- `lib/ai/context-builder.ts`'s `buildUserContext(userId, options?: {
  twinMode?: boolean })` — when `options.twinMode` is true, additionally
  calls `buildTwinContextSummary(userId)` and includes the result as
  `twinContext` on the returned `CognitiveContext` object (present in both
  the success path and the `null`-on-cold-start / fallback path, same
  discipline as the `activeSignal` field added earlier this session).
- **Server-side plan gating (the real security boundary, not just UI)**:
  wherever the chat route (`app/api/ai/stream/route.ts` and/or
  `app/api/ai/generate/route.ts`) reads a `twinMode` flag from the request
  body, it must re-verify `session.user`'s `plan === 'pro'` from the
  database before passing `twinMode: true` through to `buildUserContext` —
  a Free user sending `twinMode: true` directly must be silently downgraded
  to `twinMode: false`, never trusted from the client.

## Chat Composer Switch

- New "Modo Twin" / "Modo Rápido" toggle in the chat composer
  (`components/ai/modern-chatbot/`), placed alongside the existing model
  picker.
- State lives in `components/ai/modern-chatbot/context.tsx`, mirroring the
  exact existing `selectedModel` pattern: a `twinMode` boolean persisted to
  `localStorage` under its own key, sent as `twinMode` in every chat request
  payload (alongside the existing `model` field).
- **First-load default (no stored preference yet)**: the client calls the
  existing `/api/billing/status` endpoint to read `plan`. Pro → default
  `twinMode: true`. Free → default `twinMode: false`, and the control renders
  locked with a small "Pro" badge/lock icon.
- Free users tapping the locked switch trigger the existing Stripe checkout
  flow (`POST /api/billing/checkout`, already used by
  `components/settings/settings-billing.tsx`) — it does not toggle anything.

## Testing

- Unit test for `buildTwinContextSummary()` (mirrors
  `lib/cognitive/__tests__/active-signal.test.ts`'s mocking style): mocks
  `prisma`, verifies the returned profile fields and that
  `buildCognitiveGraph` is invoked with the right shape; verifies `null` on
  no `CognitiveTwinRecord`.
- Unit test for the server-side gating: given a Free-plan user and a request
  body with `twinMode: true`, the constructed context must NOT include
  `twinContext` (i.e., the override is provably discarded, not just
  documented).
- Manual verification: a Pro test account sees the switch on by default and
  a chat response that references real profile details (e.g., chronotype);
  toggling to Modo Rápido and asking the same question shows no such
  reference; a Free test account sees the switch locked.

## Rollout

Same pattern as the rest of this session: subagent-driven-development in an
isolated worktree, typecheck → build → deploy → alias → `git push`, no
feature flag.
