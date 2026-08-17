# Cognitive Twin Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `/cognitive` from a metrics-first report into a truthful Cognitive Command Center with one primary recommendation, evidence-backed graph lenses, inspector actions, adaptive learning visibility, and accessible mobile behavior.

**Architecture:** Keep the existing Prisma domain and loop models. Add a deterministic server-side graph projection contract that accepts a lens and focus, then render one bounded snapshot in the existing SVG graph for the first vertical slice. Build the UI around a Cognitive Brief, activity/learning timeline, inspector, and textual alternative; keep Sigma + Graphology as a later scale-up once the contract is proven.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, existing Zod/SWR/Framer Motion/Tailwind UI, existing `CognitiveTwinRecord`, `ActionPlan`, `RecommendedAction`, `OutcomeEvent`, `NovoSignalLedger`, and `TwinEvolutionLog` models.

## Global Constraints

- Every graph query must filter by the authenticated `userId` and never expose raw private note bodies, prompts, tokens, credentials, or tool arguments.
- Use persisted evidence and deterministic rules first; the LLM may summarize or decompose but may not be the only decision layer.
- Never expose medical/psychological certainty, fake precision, fake biometrics, or chain-of-thought.
- Keep the graph bounded: desktop 20–35 nodes initially, mobile 8–15 nodes initially.
- Use one graph model with lenses `now`, `goals`, `patterns`, `memory`, and `sources`; do not duplicate five graphs.
- Preserve the current dark/cream/green identity and existing app shell; avoid a purple AI dashboard.
- Respect `prefers-reduced-motion`, keyboard navigation, screen readers, and a textual alternative view.
- Do not add Sigma/Graphology until the first SVG slice has tests and runtime evidence.

---

### Task 1: Create the design spec and policy test fixtures

**Files:**
- Create: `docs/superpowers/specs/2026-08-03-cognitive-twin-command-center-design.md`
- Create: `lib/cognitive/__tests__/command-center-policy.test.ts`

**Interfaces:**
- The policy tests define the behavior later projection and UI tasks must preserve: bounded lens filtering, confidence labels, exclusion, deterministic positions, and learned-outcome influence.

- [ ] **Step 1: Write the design spec**

Include the approved first viewport hierarchy, snapshot contract, inspector behavior, mobile bottom sheet, accessibility alternative, motion timings, error/empty states, and explicit exclusions.

- [ ] **Step 2: Add failing policy fixtures**

Create fixtures with one objective, one overdue blocker, one accepted action, one completed outcome, one excluded signal, and one inferred relationship. Assert that excluded evidence is absent, inferred evidence is marked, and identical candidates rank differently after a helpful/completed outcome.

- [ ] **Step 3: Run the focused tests**

Run `npx jest lib/cognitive/__tests__/command-center-policy.test.ts --runInBand`.
Expected: the new tests fail because the projection/policy functions do not exist yet.

---

### Task 2: Add typed graph snapshot projection

**Files:**
- Create: `lib/cognitive-graph/types.ts`
- Create: `lib/cognitive-graph/evidence.ts`
- Create: `lib/cognitive-graph/projection.ts`
- Create: `lib/cognitive-graph/lenses.ts`
- Create: `lib/cognitive-graph/layout.ts`
- Modify: `lib/cognitive-graph.ts` only if compatibility adapters are needed

**Interfaces:**

```ts
export type CognitiveLens = 'now' | 'goals' | 'patterns' | 'memory' | 'sources'
export type BuildGraphOptions = { userId: string; lens: CognitiveLens; focusNodeId?: string; depth?: number; limit?: number; since?: Date }
export async function buildCognitiveGraphSnapshot(options: BuildGraphOptions): Promise<CognitiveGraphSnapshot>
export function hashToUnitPair(id: string): { x: number; y: number }
export function applyGraphLens(input: { nodes: CognitiveGraphNode[]; edges: CognitiveGraphEdge[]; lens: CognitiveLens; focusNodeId?: string; depth: number }): { nodes: CognitiveGraphNode[]; edges: CognitiveGraphEdge[] }
```

- [ ] **Step 1: Define node, edge, evidence, snapshot, recommendation and change types**
- [ ] **Step 2: Load owned domain data in bounded batched queries**
- [ ] **Step 3: Normalize `NovoSignalLedger`, `OutcomeEvent`, `RecommendedAction`, `Goal`, `Task`, `CognitiveTwinRecord`, and recent `TwinEvolutionLog` into evidence-backed nodes**
- [ ] **Step 4: Apply source exclusions/corrections before lens filtering**
- [ ] **Step 5: Implement deterministic stable ordering and hash-seeded fallback positions**
- [ ] **Step 6: Apply each lens and focus depth with a strict node limit**
- [ ] **Step 7: Run the policy tests and fix all failures**

Run: `npx jest lib/cognitive/__tests__/command-center-policy.test.ts --runInBand`.
Expected: PASS.

---

### Task 3: Normalize the graph API and recommendation payload

**Files:**
- Modify: `app/api/cognitive/graph/route.ts`
- Create: `app/api/cognitive/graph/route.test.ts`
- Create: `app/api/cognitive/graph/types.ts` if route-specific schemas are needed
- Modify: `app/api/cognitive/loop/plan/route.ts` only to expose safe recommendation facts/inferences already persisted

**Interfaces:**

`GET /api/cognitive/graph?lens=now&focusNodeId=<id>&depth=2&limit=35` returns `{ snapshot, recommendation, changes }`. Invalid lens/depth/limit returns 400. Unauthenticated returns 401. Non-Pro may receive the bounded base snapshot while advanced history remains gated, or the existing product gate must preserve a truthful upgrade state.

- [ ] **Step 1: Add Zod query validation and ownership checks**
- [ ] **Step 2: Return a snapshot generated by `buildCognitiveGraphSnapshot`**
- [ ] **Step 3: Add route tests for ownership, lens switching, exclusion and deterministic output**
- [ ] **Step 4: Run `npx jest app/api/cognitive/graph/route.test.ts --runInBand`**

---

### Task 4: Build the Cognitive Brief and explainability surface

**Files:**
- Create: `components/cognitive/cognitive-brief.tsx`
- Create: `components/cognitive/cognitive-explainability.tsx`
- Modify: `components/cognitive/twin-command-center.tsx`
- Modify: `app/cognitive/page.tsx`

**Interfaces:**

`CognitiveBrief` receives a persisted recommendation `{ title, nextStep, facts, inferences, confidence, evidenceIds, actionId }` and emits `onAccept`, `onModify`, `onWhyThis`, and `onCorrect` callbacks.

- [ ] **Step 1: Move one recommendation above metrics and charts**
- [ ] **Step 2: Render Facts, Novo interpretation, Recommendation, Expected effect, Confidence and Sources in a collapsible panel**
- [ ] **Step 3: Connect Accept/Modify/Why this to existing loop endpoints or a clear route**
- [ ] **Step 4: Add visible correction and exclusion entry points**
- [ ] **Step 5: Add component tests for facts/inference separation, confidence copy and keyboard disclosure**

---

### Task 5: Add lenses, inspector and accessible alternative view

**Files:**
- Create: `components/cognitive/cognitive-lens-bar.tsx`
- Create: `components/cognitive/cognitive-graph-inspector.tsx`
- Create: `components/cognitive/cognitive-graph-list.tsx`
- Modify: `components/cognitive/cognitive-graph-view.tsx`
- Modify: `app/cognitive/page.tsx`

**Interfaces:**

`CognitiveGraphView` receives a snapshot and emits `onSelectNode`, `onFocusNode`, `onClearFocus`. `CognitiveGraphInspector` receives a selected node plus evidence and exposes correction/exclusion/action callbacks. `CognitiveGraphList` renders the same nodes/edges as text.

- [ ] **Step 1: Replace direct fetch with lens-aware SWR state**
- [ ] **Step 2: Add Now/Goals/Patterns/Memory/Sources controls with `aria-pressed` and URL state**
- [ ] **Step 3: Open inspector on click and double-click/focus on keyboard**
- [ ] **Step 4: Add breadcrumbs, search, fit/reset and Escape behavior**
- [ ] **Step 5: Add mobile bottom sheet and 8–15 node cap**
- [ ] **Step 6: Add text/list relationship view that supports the same actions**
- [ ] **Step 7: Add component tests for lens switch, inspector, keyboard, empty and reduced motion**

---

### Task 6: Show activity, learning and active loops from real records

**Files:**
- Create: `components/cognitive/cognitive-learning-timeline.tsx`
- Create: `components/cognitive/cognitive-active-loops.tsx`
- Modify: `components/cognitive/decision-feed.tsx`
- Modify: `app/cognitive/page.tsx`
- Modify: `app/api/cognitive/graph/route.ts` if safe summaries need to be included

**Interfaces:**

Timeline entries use `TwinEvolutionLog`, `OutcomeEvent`, `RecommendedAction`, and sanitized activity events. No raw chain-of-thought or private source content is allowed.

- [ ] **Step 1: Render “qué aprendió”, evidence/outcome, time, confidence and future effect**
- [ ] **Step 2: Render only a few active loops: confirmation, blocked, verification, recent completion**
- [ ] **Step 3: Add correction/delete controls where persistence already supports them**
- [ ] **Step 4: Test that a completed/helpful outcome changes the next visible strategy summary**

---

### Task 7: Visual, motion, performance and accessibility pass

**Files:**
- Modify: `app/cognitive/page.tsx`
- Modify: `components/cognitive/*` touched above
- Modify: `app/globals.css` only for shared tokens/texture rules
- Create: `public/cognitive/noise.svg` or a small optimized texture only if needed

- [ ] **Step 1: Load Impeccable craft floor and run detector once after UI edits**
- [ ] **Step 2: Remove purple/glow overload, duplicate metrics and fake provider emphasis**
- [ ] **Step 3: Use transform/opacity transitions with stable heights and reduced-motion branches**
- [ ] **Step 4: Pause graph animation when hidden or settled; avoid query per frame**
- [ ] **Step 5: Verify contrast, focus rings, target sizes and screen-reader announcements**
- [ ] **Step 6: Capture desktop/mobile/reduced-motion screenshots and record them in `docs/cognitive-page-qa.md`**

---

### Task 8: Validation and production evidence

**Files:**
- Modify: `docs/cognitive-page-qa.md`
- Modify: `docs/novo-cognitive-twin-audit.md`
- Modify: `docs/novo-proof-presence-progress.md`

- [ ] **Step 1: Run `npm run lint`**
- [ ] **Step 2: Run `node --max-old-space-size=4096 ./node_modules/typescript/bin/tsc --noEmit --pretty false --incremental`**
- [ ] **Step 3: Run focused Jest suites and then `npm test -- --runInBand`**
- [ ] **Step 4: Run `npm run build` or the production Vercel build**
- [ ] **Step 5: Run browser QA for desktop, mobile, reduced motion, empty/error and authenticated Cognitive**
- [ ] **Step 6: Update docs with exact results, screenshots, remaining risks and deployment URL**
