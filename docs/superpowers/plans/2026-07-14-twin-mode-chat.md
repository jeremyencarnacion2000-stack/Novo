# Twin Mode Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the AI chat access to the full Cognitive Twin profile + graph, gated behind a Pro-only "Modo Twin" / "Modo Rápido" switch in the composer — the first real monetization hook built this session.

**Architecture:** A new pure-ish data-assembly function (`buildTwinContextSummary`) reuses the exact fetch pattern already proven in `app/api/cognitive/graph/route.ts` and the already-tested `buildCognitiveGraph()`. It plugs into the existing `buildUserContext()` pipeline behind a `twinMode` flag. The chat route re-verifies the user's plan server-side before honoring that flag — the client-sent value is never trusted directly. The composer gets a small toggle component mirroring the existing `ModelSelector` component's exact shape and state-persistence pattern.

**Tech Stack:** Next.js API routes, Prisma, React Context (existing `ChatbotProvider`), Jest.

## Global Constraints

- `twinMode` is `true` only when BOTH the client requested it AND `user.plan === 'pro'` (checked fresh from the DB on every request, not cached/trusted from the client or from a stale session value).
- `buildTwinContextSummary` returns `null` when no `CognitiveTwinRecord` exists yet (cold-start user) — never fabricate profile data.
- No new dependency, no new route beyond what's listed — `/api/billing/status` and `/api/billing/checkout` already exist and are reused as-is.
- Every task ends with `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit --incremental` showing no *new* errors beyond the pre-existing baseline (currently 70).

---

### Task 1: `buildTwinContextSummary`

**Files:**
- Create: `lib/cognitive/twin-context.ts`
- Create: `lib/cognitive/__tests__/twin-context.test.ts`

**Interfaces:**
- Consumes: `buildCognitiveGraph` from `@/lib/cognitive-graph` (existing, unchanged), `prisma` from `@/lib/prisma`.
- Produces: `TwinProfile` type, `TwinContextSummary` type (`{ profile: TwinProfile; graph: CognitiveGraph }`), and `buildTwinContextSummary(userId: string): Promise<TwinContextSummary | null>`. Task 2 imports both types and the function by these exact names.

- [ ] **Step 1: Write the failing tests**

Create `lib/cognitive/__tests__/twin-context.test.ts`:

```ts
/// <reference types="jest" />
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    cognitiveTwinRecord: { findUnique: jest.fn() },
    behavioralSignal: { groupBy: jest.fn() },
    twinEvolutionLog: { findMany: jest.fn() },
  },
}));

import { buildTwinContextSummary } from '../twin-context';

describe('buildTwinContextSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when the user has no CognitiveTwinRecord yet', async () => {
    (prisma.cognitiveTwinRecord.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.behavioralSignal.groupBy as jest.Mock).mockResolvedValue([]);
    (prisma.twinEvolutionLog.findMany as jest.Mock).mockResolvedValue([]);

    const result = await buildTwinContextSummary('user-1');
    expect(result).toBeNull();
  });

  it('returns the profile fields and a graph when a CognitiveTwinRecord exists', async () => {
    (prisma.cognitiveTwinRecord.findUnique as jest.Mock).mockResolvedValue({
      identity: { role: 'founder', industry: 'technology', focusStyle: 'deep_builder', deepWorkCapacity: 4.5 },
      energyCurve: { chronotype: 'night_owl', peakFocusStart: '20:00', peakFocusEnd: '23:00' },
      metrics: { currentCognitiveLoad: 35, decisionFatigueRisk: 'low', burnoutIndex: 15 },
      bottlenecks: { mainFrictionPoint: 'context_switching' },
      trustLevel: 'adapted',
      confidenceScore: 78,
    });
    (prisma.behavioralSignal.groupBy as jest.Mock).mockResolvedValue([
      { signal: 'task_completed', _count: { signal: 12 } },
    ]);
    (prisma.twinEvolutionLog.findMany as jest.Mock).mockResolvedValue([
      { changeType: 'trust_level_up' },
    ]);

    const result = await buildTwinContextSummary('user-1');

    expect(result).not.toBeNull();
    expect(result?.profile.trustLevel).toBe('adapted');
    expect(result?.profile.confidenceScore).toBe(78);
    expect(result?.profile.identity.role).toBe('founder');
    expect(result?.profile.energyCurve.chronotype).toBe('night_owl');
    expect(result?.profile.bottlenecks.mainFrictionPoint).toBe('context_switching');
    expect(result?.graph.nodes.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `npx jest lib/cognitive/__tests__/twin-context.test.ts`
Expected: FAIL — `Cannot find module '../twin-context'`.

- [ ] **Step 3: Implement**

Create `lib/cognitive/twin-context.ts`:

```ts
// Full Cognitive Twin profile + graph, for chat's "Modo Twin". Reuses the
// exact fetch pattern already proven in app/api/cognitive/graph/route.ts —
// this is a superset of that route's data (adds trustLevel/confidenceScore,
// needed for the chat context but not for the visual graph).

import { prisma } from '@/lib/prisma';
import { buildCognitiveGraph, type CognitiveGraph } from '@/lib/cognitive-graph';

export interface TwinProfile {
  identity: { role?: string; industry?: string; focusStyle?: string; deepWorkCapacity?: number };
  energyCurve: { chronotype?: string; peakFocusStart?: string; peakFocusEnd?: string };
  metrics: { currentCognitiveLoad?: number; decisionFatigueRisk?: string; burnoutIndex?: number };
  bottlenecks: { mainFrictionPoint?: string };
  trustLevel: string;
  confidenceScore: number;
}

export interface TwinContextSummary {
  profile: TwinProfile;
  graph: CognitiveGraph;
}

export async function buildTwinContextSummary(userId: string): Promise<TwinContextSummary | null> {
  const [twinRecord, signalGroups, recentLogs] = await Promise.all([
    prisma.cognitiveTwinRecord.findUnique({
      where: { userId },
      select: {
        identity: true,
        energyCurve: true,
        metrics: true,
        bottlenecks: true,
        trustLevel: true,
        confidenceScore: true,
      },
    }),
    prisma.behavioralSignal.groupBy({
      by: ['signal'],
      where: { userId, occurredAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      _count: { signal: true },
    }),
    prisma.twinEvolutionLog.findMany({
      where: { userId, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      select: { changeType: true },
    }),
  ]);

  if (!twinRecord) return null;

  const signalCounts = signalGroups.map(g => ({ signal: g.signal, count: g._count.signal }));
  const graph = buildCognitiveGraph(twinRecord, signalCounts, recentLogs.map(l => l.changeType));

  return {
    profile: {
      identity: (twinRecord.identity as TwinProfile['identity']) || {},
      energyCurve: (twinRecord.energyCurve as TwinProfile['energyCurve']) || {},
      metrics: (twinRecord.metrics as TwinProfile['metrics']) || {},
      bottlenecks: (twinRecord.bottlenecks as TwinProfile['bottlenecks']) || {},
      trustLevel: twinRecord.trustLevel,
      confidenceScore: twinRecord.confidenceScore,
    },
    graph,
  };
}
```

- [ ] **Step 4: Run to confirm it passes**

Run: `npx jest lib/cognitive/__tests__/twin-context.test.ts`
Expected: PASS (2/2).

- [ ] **Step 5: Typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit --incremental 2>&1 | grep -c "error TS"`
Expected: 70 (baseline, unchanged). If `buildCognitiveGraph`'s exported type for its first parameter isn't named `TwinRecordLike` and exported, use whatever type-shape `app/api/cognitive/graph/route.ts` currently passes (a bare object with `identity`/`energyCurve`/`metrics`/`bottlenecks`) — the extra `trustLevel`/`confidenceScore` fields on the object passed to `buildCognitiveGraph` are harmless excess properties since it's not a literal passed to a strictly-typed parameter in a position that triggers excess-property checking.

- [ ] **Step 6: Commit**

```bash
git add lib/cognitive/twin-context.ts lib/cognitive/__tests__/twin-context.test.ts
git commit -m "feat(cognitive): buildTwinContextSummary — full profile + graph for chat"
```

---

### Task 2: Wire into `buildUserContext`

**Files:**
- Modify: `lib/ai/context-builder.ts`

**Interfaces:**
- Consumes: `buildTwinContextSummary`, `TwinContextSummary` from Task 1's `lib/cognitive/twin-context.ts`.
- Produces: `buildUserContext(userId: string, options?: { twinMode?: boolean }): Promise<UserContext>` — `CognitiveContext.twinContext: TwinContextSummary | null` added as a new top-level field. Task 3 calls `buildUserContext` with `{ twinMode }`; Task 3's prompt-assembly step reads `context.structured.twinContext`.

- [ ] **Step 1: Add the import and the `twinContext` field to `CognitiveContext`**

In `lib/ai/context-builder.ts`, add near the top:

```ts
import { buildTwinContextSummary, type TwinContextSummary } from '@/lib/cognitive/twin-context';
```

Add `twinContext: TwinContextSummary | null;` as a new top-level field on the `CognitiveContext` interface (sibling of `system`, `todaySchedule`, `metrics`, `state`, `preferences`, and the `activeSignal` field added earlier this session).

- [ ] **Step 2: Change the function signature and conditionally fetch**

Change:
```ts
export async function buildUserContext(userId: string): Promise<UserContext> {
```
to:
```ts
export async function buildUserContext(userId: string, options?: { twinMode?: boolean }): Promise<UserContext> {
```

Inside the `try` block, after the existing `Promise.all` that builds `structuredContext` (the one already extended with `getActiveSignal` earlier this session), add:

```ts
        const twinContext = options?.twinMode ? await buildTwinContextSummary(userId) : null;
```

Add `twinContext,` to the `structuredContext` object literal (sibling of `activeSignal`).

- [ ] **Step 3: Add the field to the fallback path**

In the `catch` block's `fallback` object, add `twinContext: null,` (sibling of the existing `activeSignal: null,` added earlier this session).

- [ ] **Step 4: Typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit --incremental 2>&1 | grep -c "error TS"`
Expected: 70 (baseline, unchanged).

- [ ] **Step 5: Commit**

```bash
git add lib/ai/context-builder.ts
git commit -m "feat(ai): buildUserContext accepts twinMode, includes full Twin context"
```

---

### Task 3: Server-side gating in the chat route

**Files:**
- Modify: `app/api/ai/stream/route.ts`
- Create: `app/api/ai/stream/__tests__/twin-mode-gating.test.ts`

**Interfaces:**
- Consumes: `buildUserContext` (Task 2's new signature).
- Produces: nothing downstream — this is the terminal enforcement point.

- [ ] **Step 1: Write the failing test**

This route is a Next.js route module exporting `POST` — it can be imported directly in a Jest `node` environment test, same convention as `tests/actions.test.ts` importing from `lib/ai/executor.ts`. Create `app/api/ai/stream/__tests__/twin-mode-gating.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
  },
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({ user: { id: 'user-1' } }),
}));

jest.mock('@/lib/ai/context-builder', () => ({
  buildUserContext: jest.fn().mockResolvedValue({
    summary: '{}',
    structured: { activeSignal: null, twinContext: null },
  }),
}));

import { buildUserContext } from '@/lib/ai/context-builder';

describe('Twin Mode server-side gating', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not pass twinMode: true through to buildUserContext for a Free-plan user even if the request asks for it', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ plan: 'free' });

    const { POST } = await import('../route');
    const request = new Request('http://localhost/api/ai/stream', {
      method: 'POST',
      body: JSON.stringify({ message: 'hola', history: [], twinMode: true }),
    });
    await POST(request as any);

    expect(buildUserContext).toHaveBeenCalledWith('user-1', { twinMode: false });
  });

  it('passes twinMode: true through to buildUserContext for a Pro-plan user who asked for it', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ plan: 'pro' });

    const { POST } = await import('../route');
    const request = new Request('http://localhost/api/ai/stream', {
      method: 'POST',
      body: JSON.stringify({ message: 'hola', history: [], twinMode: true }),
    });
    await POST(request as any);

    expect(buildUserContext).toHaveBeenCalledWith('user-1', { twinMode: true });
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `npx jest app/api/ai/stream/__tests__/twin-mode-gating.test.ts`
Expected: FAIL — `buildUserContext` is currently called with only one argument (`userId`), so `toHaveBeenCalledWith('user-1', { twinMode: false })` doesn't match.

- [ ] **Step 3: Implement the gating**

In `app/api/ai/stream/route.ts`, change line 110's destructure from:

```ts
        let { message, history, attachments, webSearchEnabled, model: requestedModel } = await request.json();
```

to:

```ts
        let { message, history, attachments, webSearchEnabled, model: requestedModel, twinMode: requestedTwinMode } = await request.json();
```

Immediately after the existing `userId` line (line 109), add the plan check:

```ts
        // Twin Mode is Pro-only — re-verify server-side on every request,
        // never trust the client's requested value directly.
        let twinMode = false;
        if (requestedTwinMode) {
            const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
            twinMode = user?.plan === 'pro';
        }
```

`prisma` is not currently imported in this file — add `import { prisma } from '@/lib/prisma';` after the existing `import { authOptions } from '@/lib/auth';` line (line 12).

Change the `buildUserContext` call (currently line 165) from:

```ts
        const context = await buildUserContext(userId);
```

to:

```ts
        const context = await buildUserContext(userId, { twinMode });
```

- [ ] **Step 4: Run to confirm it passes**

Run: `npx jest app/api/ai/stream/__tests__/twin-mode-gating.test.ts`
Expected: PASS (2/2).

- [ ] **Step 5: Add the Twin context to the prompt when present**

Immediately before the existing `finalPrompt` line (which already includes `activeSignalContext` from earlier this session), add:

```ts
        const twinContextStr = context.structured.twinContext
            ? `\n\nPERFIL COMPLETO DEL TWIN (Modo Twin activo):\n${JSON.stringify(context.structured.twinContext, null, 2)}`
            : '';
```

Change the `finalPrompt` line to append it:

```ts
        const finalPrompt = `${selectedPrompt}\n\n${userContext}\n\n${timeCtx}${webSearchContext}${activeSignalContext}${twinContextStr}`;
```

- [ ] **Step 6: Typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit --incremental 2>&1 | grep -c "error TS"`
Expected: 70 (baseline, unchanged).

- [ ] **Step 7: Commit**

```bash
git add app/api/ai/stream/route.ts app/api/ai/stream/__tests__/twin-mode-gating.test.ts
git commit -m "feat(ai): server-side Pro-plan gating for Twin Mode"
```

---

### Task 4: Chatbot client state (`twinMode`)

**Files:**
- Modify: `components/ai/modern-chatbot/types.ts`
- Modify: `components/ai/modern-chatbot/context.tsx`

**Interfaces:**
- Produces: `ChatbotContextType.twinMode: boolean`, `ChatbotContextType.setTwinMode: (v: boolean) => void`, `ChatbotContextType.twinModeAvailable: boolean` (true only for Pro users — the UI uses this to decide whether the switch is locked). Task 5 (`TwinModeToggle`) consumes all three by these exact names via `useChatbot()`.

- [ ] **Step 1: Add the fields to `ChatbotContextType`**

In `components/ai/modern-chatbot/types.ts`, add after the existing `// Model Selection` block (`selectedModel`, `setSelectedModel`, `availableModels`):

```ts
    // Twin Mode (Pro-only)
    twinMode: boolean;
    setTwinMode: (enabled: boolean) => void;
    twinModeAvailable: boolean;
```

- [ ] **Step 2: Add the state, plan check, and persistence to `ChatbotProvider`**

In `components/ai/modern-chatbot/context.tsx`, add a new storage key near the existing ones (line 16-18):

```ts
const TWIN_MODE_KEY = 'modern-chatbot-twin-mode';
```

Add state near `selectedModel` (line 30):

```ts
    const [twinMode, setTwinMode] = useState(false);
    const [twinModeAvailable, setTwinModeAvailable] = useState(false);
```

In the mount `useEffect` (the one currently loading `sidebarState`/`storedModel`, lines 113-134), add, after the existing `storedModel` block:

```ts
        fetch('/api/billing/status')
            .then(r => r.ok ? r.json() : null)
            .then(status => {
                const isPro = status?.plan === 'pro';
                setTwinModeAvailable(isPro);

                const storedTwinMode = localStorage.getItem(TWIN_MODE_KEY);
                if (storedTwinMode !== null) {
                    // Respect an explicit prior choice, but never let a
                    // stale "true" survive a plan downgrade.
                    setTwinMode(isPro && storedTwinMode === 'true');
                } else {
                    // First run: Pro defaults on (immediate value
                    // demonstration), Free defaults off (locked anyway).
                    setTwinMode(isPro);
                }
            })
            .catch(() => {});
```

Add a persistence effect near the existing "Save model selection" effect (lines 202-205):

```ts
    // Save Twin Mode preference
    useEffect(() => {
        localStorage.setItem(TWIN_MODE_KEY, twinMode.toString());
    }, [twinMode]);
```

- [ ] **Step 3: Send `twinMode` in the chat request**

In `sendMessage`'s `fetch('/api/ai/stream', ...)` call (the body object currently `{ message, history, attachments, webSearchEnabled, model: selectedModel }`, around line 413-419), add `twinMode` as a sibling field:

```ts
                body: JSON.stringify({
                    message: processedContent,
                    history: history.map(m => ({ role: m.role, content: m.content })),
                    attachments: messageAttachments,
                    webSearchEnabled,
                    model: selectedModel,
                    twinMode
                })
```

Add `twinMode` to `sendMessage`'s `useCallback` dependency array (currently `[currentConversationId, selectedModel]`, becomes `[currentConversationId, selectedModel, twinMode]`).

(`editMessage` and `confirmAction`'s auto-follow-up already don't send `model` either — leave both as-is, matching that existing, unrelated inconsistency; not in scope here.)

- [ ] **Step 4: Expose the new fields from the provider**

In the `value: ChatbotContextType` object at the bottom of the file, add `twinMode, setTwinMode, twinModeAvailable,` as siblings of `selectedModel, setSelectedModel, availableModels,`.

- [ ] **Step 5: Typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit --incremental 2>&1 | grep -c "error TS"`
Expected: 70 (baseline, unchanged).

- [ ] **Step 6: Commit**

```bash
git add components/ai/modern-chatbot/types.ts components/ai/modern-chatbot/context.tsx
git commit -m "feat(chatbot): Twin Mode client state, persistence, and plan-aware default"
```

---

### Task 5: `TwinModeToggle` component + composer wiring

**Files:**
- Create: `components/ai/modern-chatbot/twin-mode-toggle.tsx`
- Modify: `components/ai/modern-chatbot/chat-input.tsx`

**Interfaces:**
- Consumes: `twinMode`, `setTwinMode`, `twinModeAvailable` from `useChatbot()` (Task 4).
- Produces: nothing downstream.

- [ ] **Step 1: Create the toggle component**

Create `components/ai/modern-chatbot/twin-mode-toggle.tsx`, mirroring `model-selector.tsx`'s self-contained style:

```tsx
'use client';

import React from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { useChatbot } from './context';

export function TwinModeToggle() {
    const { twinMode, setTwinMode, twinModeAvailable } = useChatbot();
    const [upgrading, setUpgrading] = React.useState(false);

    const handleClick = async () => {
        if (!twinModeAvailable) {
            setUpgrading(true);
            try {
                const res = await fetch('/api/billing/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ interval: 'month' }),
                });
                const data = await res.json();
                if (data.url) window.location.href = data.url;
            } catch {
                // Silent — this mirrors settings-billing.tsx's own checkout
                // error handling (a toast there; here we just stop spinning,
                // since a failed upgrade attempt from the chat composer
                // isn't as evidently a place to add auto-verifiying toast
                // infra of its own).
            } finally {
                setUpgrading(false);
            }
            return;
        }
        setTwinMode(!twinMode);
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={upgrading}
            title={twinModeAvailable ? 'Modo Twin: usa tu perfil cognitivo completo' : 'Modo Twin — función Pro'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                twinModeAvailable && twinMode
                    ? 'bg-primary/15 border-primary/30 text-primary'
                    : 'bg-[#0a0a0f]/80 border-white/5 hover:border-primary/30 text-white/60 hover:text-white/80'
            }`}
        >
            {twinModeAvailable ? (
                <Sparkles className="w-3 h-3" />
            ) : (
                <Lock className="w-3 h-3" />
            )}
            <span>{twinModeAvailable ? (twinMode ? 'Modo Twin' : 'Modo Rápido') : 'Modo Twin'}</span>
            {!twinModeAvailable && (
                <span className="text-[9px] uppercase tracking-wide bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">Pro</span>
            )}
        </button>
    );
}
```

- [ ] **Step 2: Wire it into the composer**

In `components/ai/modern-chatbot/chat-input.tsx`, add the import near the existing `ModelSelector` import:

```tsx
import { TwinModeToggle } from './twin-mode-toggle';
```

In the "Left Controls" div (currently lines 244-259, containing the attach button and `<ModelSelector />`), add the toggle as a sibling right after the `ModelSelector` wrapper div:

```tsx
                                {/* Model — plain text, no pill/border */}
                                <div className="animate-in fade-in duration-300">
                                    <ModelSelector />
                                </div>

                                <TwinModeToggle />
```

- [ ] **Step 3: Typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit --incremental 2>&1 | grep -c "error TS"`
Expected: 70 (baseline, unchanged).

- [ ] **Step 4: Manual verification**

Run the dev server (or test against a deployed preview). As a Pro test account: confirm the composer shows "Modo Twin" active by default, ask something like "¿cuál es mi cronotipo?" and confirm the response references real profile data; toggle to "Modo Rápido" and confirm a repeat question gets a generic answer with no profile reference. As a Free test account: confirm the control shows the lock + "Pro" badge, and clicking it redirects to Stripe checkout rather than toggling anything.

- [ ] **Step 5: Commit**

```bash
git add components/ai/modern-chatbot/twin-mode-toggle.tsx components/ai/modern-chatbot/chat-input.tsx
git commit -m "feat(chatbot): Twin Mode toggle in the composer, Pro-gated with upgrade CTA"
```

---

### Task 6: Full verification pass

**Files:** none (verification only, plus fixing anything it surfaces)

**Interfaces:** none.

- [ ] **Step 1: Full typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit --incremental 2>&1 | tee /tmp/tsc_final.txt | grep -c "error TS"`
Expected: 70 (baseline). Confirm none of the 70 are in any file this plan touched:

Run: `grep -E "cognitive/twin-context|ai/context-builder|ai/stream/route|modern-chatbot/(types|context|chat-input|twin-mode-toggle)" /tmp/tsc_final.txt`
Expected: no output.

- [ ] **Step 2: Full relevant test run**

Run: `npx jest lib/cognitive app/api/ai/stream components/ai/modern-chatbot`
Expected: all PASS (allow for the same pre-existing unrelated failures noted earlier this session, if any exist under these paths — cross-check by name against the known baseline before treating any failure as new).

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual end-to-end verification**

If not already covered by Task 5 Step 4: confirm with a real Pro account and a real Free account, per that step's script.

- [ ] **Step 5: Fix anything surfaced by Steps 1-4**

If any check fails, fix it directly and re-run the failing check until it passes.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore(chatbot): verification pass for Twin Mode"
```

(Only commit if Step 5 produced fixes — skip if everything passed clean on the first pass.)
