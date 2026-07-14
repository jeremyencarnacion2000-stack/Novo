# Notion Signal + Active Surfacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect three behavioral patterns in a user's already-synced Notion tasks and surface the most relevant one via the existing "Ahora →" hero card and, when relevant, the AI chat — reusing the exact architecture Active Calendar Signal established, plus one shared `getActiveSignal()` so Calendar and Notion signals can never disagree about which one to show.

**Architecture:** New `lib/cognitive/notion-signal.ts` (mirrors `lib/cognitive/calendar-signal.ts`) computing three thresholds from already-synced `ChecklistItem` rows (`source: 'notion'`) — no new API calls, no new auth. A small refactor extracts the (already-generic) `TwinEvolutionLog` persistence helper out of `calendar-signal.ts` into a shared `lib/cognitive/platform-signals.ts`, since it was never calendar-specific in its body, just its name and location. A new `lib/cognitive/active-signal.ts` reads today's signals across both platforms and picks one by priority (Notion > Calendar), used by `now-hero.tsx`, a new thin API route, and the AI context-builder. The ambient toast surface needs no new code — `components/cognitive/twin-insight-toast.tsx` already polls `TwinEvolutionLog` and toasts any new entry regardless of type.

**Tech Stack:** Next.js API routes, Prisma, Jest (mirroring `lib/cognitive/__tests__/calendar-signal.test.ts`'s test structure and date-handling lessons).

## Global Constraints

- Notion signal `changeType` values: `notion_overdue_accumulation`, `notion_stagnation`, `notion_priority_due_soon` — exact strings, used both when persisting and when `getActiveSignal` filters by `startsWith('notion_')`.
- Threshold values (exact, from the approved spec): overdue accumulation fires at ≥3 incomplete items with `dueDate` in the past; stagnation fires when ≥3 items were created/updated in the last 7 days with zero completions in that window; high-priority-due-soon fires for an incomplete `priority: 'high'` item with `dueDate` within the next 2 hours.
- Priority order for `getActiveSignal`: a Notion signal logged today wins over a Calendar signal logged today; the urgent-task check itself stays in `now-hero.tsx` exactly where it is today (not part of this function — it's derived from `Task` rows, not a platform signal).
- Every task ends with `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit --incremental` showing no *new* errors beyond the pre-existing baseline (currently 70 — confirm the count doesn't increase).
- No new toast component, no new toast endpoint — `TwinInsightToast` (`components/cognitive/twin-insight-toast.tsx`) already covers this surface for any `TwinEvolutionLog` entry.
- Known, accepted limitation (do not attempt to fix in this plan): Notion signals reflect data as of the last manual sync, not live Notion state.

---

### Task 1: Extract shared platform-signal persistence

**Files:**
- Create: `lib/cognitive/platform-signals.ts`
- Create: `lib/cognitive/__tests__/platform-signals.test.ts`
- Modify: `lib/cognitive/calendar-signal.ts:1-7,120-148` (remove `persistNewCalendarSignals` and its now-unused imports)
- Modify: `lib/cognitive/__tests__/calendar-signal.test.ts:118-156` (remove the `persistNewCalendarSignals` describe block and its import)
- Modify: `app/api/ai/cognitive-engine/route.ts:11,157` (import and call the new shared function instead)

**Interfaces:**
- Produces: `persistNewPlatformSignals(twinId: string, userId: string, signals: PlatformSignal[]): Promise<void>` — identical behavior to today's `persistNewCalendarSignals` (same dedup: at most one `TwinEvolutionLog` row per `changeType` per calendar day). Task 2 and Task 3 both import this from `lib/cognitive/platform-signals.ts`.
- Consumes: `PlatformSignal` from `@/lib/platform-connectors/types` (unchanged), `prisma` from `@/lib/prisma`.

**Why this refactor first:** `persistNewCalendarSignals`'s body was never calendar-specific — it takes generic `PlatformSignal[]` and writes generic `TwinEvolutionLog` rows. Notion needs the exact same persistence logic; duplicating it under a new name would leave two copies of identical code. Doing this extraction as its own task, before Notion code exists, means Calendar's existing tests prove the refactor didn't change behavior before anything new is layered on top.

- [ ] **Step 1: Write the failing test for the extracted function**

Create `lib/cognitive/__tests__/platform-signals.test.ts`:

```ts
/// <reference types="jest" />
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    twinEvolutionLog: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { persistNewPlatformSignals } from '../platform-signals';

describe('persistNewPlatformSignals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes a new TwinEvolutionLog row when none exists today for that changeType', async () => {
    (prisma.twinEvolutionLog.findFirst as jest.Mock).mockResolvedValue(null);

    await persistNewPlatformSignals('twin-1', 'user-1', [
      { type: 'notion_overdue_accumulation', headline: '3 tareas de Notion vencidas', detail: 'detalle', severity: 'warning' },
    ]);

    expect(prisma.twinEvolutionLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        twinId: 'twin-1',
        userId: 'user-1',
        changeType: 'notion_overdue_accumulation',
      }),
    });
  });

  it('does not write a duplicate row when one already exists today for that changeType', async () => {
    (prisma.twinEvolutionLog.findFirst as jest.Mock).mockResolvedValue({ id: 'existing-row' });

    await persistNewPlatformSignals('twin-1', 'user-1', [
      { type: 'notion_overdue_accumulation', headline: '3 tareas de Notion vencidas', detail: 'detalle', severity: 'warning' },
    ]);

    expect(prisma.twinEvolutionLog.create).not.toHaveBeenCalled();
  });

  it('does nothing when there are no signals', async () => {
    await persistNewPlatformSignals('twin-1', 'user-1', []);
    expect(prisma.twinEvolutionLog.findFirst).not.toHaveBeenCalled();
    expect(prisma.twinEvolutionLog.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx jest lib/cognitive/__tests__/platform-signals.test.ts`
Expected: FAIL — `Cannot find module '../platform-signals'`.

- [ ] **Step 3: Create the shared implementation**

Create `lib/cognitive/platform-signals.ts`:

```ts
// Shared TwinEvolutionLog persistence for any PlatformConnector's detected
// signals — extracted from calendar-signal.ts, whose implementation was
// never calendar-specific, just its name and location. Every platform
// (Calendar, Notion, and whatever comes next) writes through this one path.

import type { PlatformSignal } from '@/lib/platform-connectors/types';
import { prisma } from '@/lib/prisma';

export async function persistNewPlatformSignals(
  twinId: string,
  userId: string,
  signals: PlatformSignal[]
): Promise<void> {
  if (signals.length === 0) return;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  for (const signal of signals) {
    const existing = await prisma.twinEvolutionLog.findFirst({
      where: { twinId, changeType: signal.type, createdAt: { gte: todayStart } },
    });
    if (existing) continue;

    await prisma.twinEvolutionLog.create({
      data: {
        twinId,
        userId,
        changeType: signal.type,
        description: `${signal.headline} — ${signal.detail}`,
      },
    });
  }
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `npx jest lib/cognitive/__tests__/platform-signals.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Remove the now-duplicate function from calendar-signal.ts**

In `lib/cognitive/calendar-signal.ts`, delete the entire `persistNewCalendarSignals` function (currently lines 120-148, the comment block and function together) and remove the now-unused `import { prisma } from '@/lib/prisma';` (line 7) if nothing else in the file uses `prisma` — check with `grep -n "prisma\." lib/cognitive/calendar-signal.ts` first; if the only use was inside the deleted function, remove the import too.

- [ ] **Step 6: Update calendar-signal.test.ts**

In `lib/cognitive/__tests__/calendar-signal.test.ts`, delete the `import { persistNewCalendarSignals } from '../calendar-signal';` line and the entire `describe('persistNewCalendarSignals', ...)` block (currently lines 118-156) — that coverage now lives in `platform-signals.test.ts`. Also remove the `jest.mock('@/lib/prisma', ...)` block at the top of the file (lines 4-11) if `computeCalendarSignal` and `evaluateCalendarThresholds` (the only functions this file still tests) don't touch `prisma` — check by running the test suite after removal.

- [ ] **Step 7: Update the cognitive-engine route's import and call site**

In `app/api/ai/cognitive-engine/route.ts`, change line 11 from:

```ts
import { computeCalendarSignal, evaluateCalendarThresholds, persistNewCalendarSignals, WAKING_HOURS_START, WAKING_HOURS_END, type CalendarSignal } from '@/lib/cognitive/calendar-signal';
```

to:

```ts
import { computeCalendarSignal, evaluateCalendarThresholds, WAKING_HOURS_START, WAKING_HOURS_END, type CalendarSignal } from '@/lib/cognitive/calendar-signal';
import { persistNewPlatformSignals } from '@/lib/cognitive/platform-signals';
```

And change the call at (currently) line 157 from:

```ts
        await persistNewCalendarSignals(twinRecord.id, userId, thresholdSignals);
```

to:

```ts
        await persistNewPlatformSignals(twinRecord.id, userId, thresholdSignals);
```

- [ ] **Step 8: Run the full relevant test suite and typecheck**

Run: `npx jest lib/cognitive/__tests__/calendar-signal.test.ts lib/cognitive/__tests__/platform-signals.test.ts`
Expected: all PASS.

Run: `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit --incremental 2>&1 | grep -c "error TS"`
Expected: 70 (baseline, unchanged).

- [ ] **Step 9: Commit**

```bash
git add lib/cognitive/platform-signals.ts lib/cognitive/__tests__/platform-signals.test.ts lib/cognitive/calendar-signal.ts lib/cognitive/__tests__/calendar-signal.test.ts app/api/ai/cognitive-engine/route.ts
git commit -m "refactor(cognitive): extract shared platform-signal persistence

persistNewCalendarSignals was never calendar-specific in its body, just
its name and location — moved to lib/cognitive/platform-signals.ts so
Notion's signals (next task) reuse it instead of duplicating it."
```

---

### Task 2: Notion signal detection

**Files:**
- Create: `lib/cognitive/notion-signal.ts`
- Create: `lib/cognitive/__tests__/notion-signal.test.ts`

**Interfaces:**
- Consumes: `PlatformSignal` from `@/lib/platform-connectors/types` (unchanged).
- Produces: `NotionChecklistItemLite` type and `evaluateNotionThresholds(items: NotionChecklistItemLite[], now: Date): PlatformSignal[]`. Task 3 imports both by these exact names.

- [ ] **Step 1: Write the failing tests**

Create `lib/cognitive/__tests__/notion-signal.test.ts`:

```ts
/// <reference types="jest" />
import { evaluateNotionThresholds, type NotionChecklistItemLite } from '../notion-signal';

describe('evaluateNotionThresholds', () => {
  const now = new Date('2026-07-14T12:00:00');

  function item(overrides: Partial<NotionChecklistItemLite>): NotionChecklistItemLite {
    return {
      id: 'item-1',
      completed: false,
      priority: 'medium',
      dueDate: null,
      updatedAt: now,
      ...overrides,
    };
  }

  it('returns no signals for an empty list', () => {
    expect(evaluateNotionThresholds([], now)).toEqual([]);
  });

  it('flags overdue accumulation at 3 or more incomplete overdue items', () => {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const items = [
      item({ id: '1', dueDate: yesterday }),
      item({ id: '2', dueDate: yesterday }),
      item({ id: '3', dueDate: yesterday }),
    ];
    const result = evaluateNotionThresholds(items, now);
    const signal = result.find(s => s.type === 'notion_overdue_accumulation');
    expect(signal).toBeDefined();
    expect(signal?.headline).toContain('3');
  });

  it('does not flag overdue accumulation with only 2 overdue items', () => {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const items = [
      item({ id: '1', dueDate: yesterday }),
      item({ id: '2', dueDate: yesterday }),
    ];
    const result = evaluateNotionThresholds(items, now);
    expect(result.find(s => s.type === 'notion_overdue_accumulation')).toBeUndefined();
  });

  it('does not count completed items as overdue', () => {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const items = [
      item({ id: '1', dueDate: yesterday, completed: true }),
      item({ id: '2', dueDate: yesterday, completed: true }),
      item({ id: '3', dueDate: yesterday, completed: true }),
    ];
    const result = evaluateNotionThresholds(items, now);
    expect(result.find(s => s.type === 'notion_overdue_accumulation')).toBeUndefined();
  });

  it('flags stagnation when 3+ items touched in the last 7 days have zero completions', () => {
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const items = [
      item({ id: '1', updatedAt: twoDaysAgo }),
      item({ id: '2', updatedAt: twoDaysAgo }),
      item({ id: '3', updatedAt: twoDaysAgo }),
    ];
    const result = evaluateNotionThresholds(items, now);
    expect(result.find(s => s.type === 'notion_stagnation')).toBeDefined();
  });

  it('does not flag stagnation when at least one recent item is completed', () => {
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const items = [
      item({ id: '1', updatedAt: twoDaysAgo, completed: true }),
      item({ id: '2', updatedAt: twoDaysAgo }),
      item({ id: '3', updatedAt: twoDaysAgo }),
    ];
    const result = evaluateNotionThresholds(items, now);
    expect(result.find(s => s.type === 'notion_stagnation')).toBeUndefined();
  });

  it('does not flag stagnation for items outside the 7-day window', () => {
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const items = [
      item({ id: '1', updatedAt: twoWeeksAgo }),
      item({ id: '2', updatedAt: twoWeeksAgo }),
      item({ id: '3', updatedAt: twoWeeksAgo }),
    ];
    const result = evaluateNotionThresholds(items, now);
    expect(result.find(s => s.type === 'notion_stagnation')).toBeUndefined();
  });

  it('flags a high-priority item due within the next 2 hours', () => {
    const soon = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    const items = [item({ id: '1', priority: 'high', dueDate: soon })];
    const result = evaluateNotionThresholds(items, now);
    expect(result.find(s => s.type === 'notion_priority_due_soon')).toBeDefined();
  });

  it('does not flag a high-priority item due more than 2 hours out', () => {
    const later = new Date(now.getTime() + 5 * 60 * 60 * 1000);
    const items = [item({ id: '1', priority: 'high', dueDate: later })];
    const result = evaluateNotionThresholds(items, now);
    expect(result.find(s => s.type === 'notion_priority_due_soon')).toBeUndefined();
  });

  it('does not flag a medium-priority item due soon', () => {
    const soon = new Date(now.getTime() + 60 * 60 * 1000);
    const items = [item({ id: '1', priority: 'medium', dueDate: soon })];
    const result = evaluateNotionThresholds(items, now);
    expect(result.find(s => s.type === 'notion_priority_due_soon')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `npx jest lib/cognitive/__tests__/notion-signal.test.ts`
Expected: FAIL — `Cannot find module '../notion-signal'`.

- [ ] **Step 3: Implement**

Create `lib/cognitive/notion-signal.ts`:

```ts
// Notion signal: three behavioral thresholds computed from already-synced
// ChecklistItem rows (source: 'notion') — see app/api/integration/notion/
// route.ts for how those rows get there. No new API calls, no new auth;
// this only reads what the existing manual sync already wrote. Mirrors
// lib/cognitive/calendar-signal.ts's shape so the cognitive-engine route
// and PlatformConnector layer treat every platform's signals uniformly.

import type { PlatformSignal } from '@/lib/platform-connectors/types';

export interface NotionChecklistItemLite {
  id: string;
  completed: boolean;
  priority: string;
  dueDate: Date | null;
  updatedAt: Date;
}

const STAGNATION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const DUE_SOON_WINDOW_MS = 2 * 60 * 60 * 1000;

export function evaluateNotionThresholds(
  items: NotionChecklistItemLite[],
  now: Date
): PlatformSignal[] {
  const results: PlatformSignal[] = [];
  if (items.length === 0) return results;

  // Overdue accumulation: 3+ incomplete items with dueDate in the past.
  const overdue = items.filter(
    i => !i.completed && i.dueDate !== null && i.dueDate.getTime() < now.getTime()
  );
  if (overdue.length >= 3) {
    results.push({
      type: 'notion_overdue_accumulation',
      headline: `${overdue.length} tareas de Notion vencidas`,
      detail: 'Se sincronizaron pero nadie les ha hecho caso todavía — vale la pena revisarlas.',
      severity: 'warning',
    });
  }

  // Stagnation: 3+ items touched in the last 7 days, zero completions among them.
  const windowStart = now.getTime() - STAGNATION_WINDOW_MS;
  const recentItems = items.filter(i => i.updatedAt.getTime() >= windowStart);
  const recentCompletions = recentItems.filter(i => i.completed);
  if (recentItems.length >= 3 && recentCompletions.length === 0) {
    results.push({
      type: 'notion_stagnation',
      headline: `${recentItems.length} tareas de Notion activas esta semana, ninguna completada`,
      detail: 'Se están acumulando sin avanzar — vale la pena revisar cuáles siguen siendo relevantes.',
      severity: 'warning',
    });
  }

  // High-priority due soon: incomplete, priority high, due within the next 2 hours.
  const soonThreshold = now.getTime() + DUE_SOON_WINDOW_MS;
  const urgentHighPriority = items.find(
    i => !i.completed &&
      i.priority === 'high' &&
      i.dueDate !== null &&
      i.dueDate.getTime() > now.getTime() &&
      i.dueDate.getTime() <= soonThreshold
  );
  if (urgentHighPriority) {
    results.push({
      type: 'notion_priority_due_soon',
      headline: 'Una tarea de alta prioridad en Notion vence en menos de 2 horas',
      detail: 'Puede valer la pena atenderla antes que las demás.',
      severity: 'warning',
    });
  }

  return results;
}
```

- [ ] **Step 4: Run to confirm it passes**

Run: `npx jest lib/cognitive/__tests__/notion-signal.test.ts`
Expected: PASS (10/10).

- [ ] **Step 5: Typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit --incremental 2>&1 | grep -c "error TS"`
Expected: 70 (baseline, unchanged).

- [ ] **Step 6: Commit**

```bash
git add lib/cognitive/notion-signal.ts lib/cognitive/__tests__/notion-signal.test.ts
git commit -m "feat(cognitive): Notion signal threshold detection

Three patterns computed from already-synced ChecklistItem rows: overdue
accumulation, stagnation, and high-priority-due-soon — same shape as
calendar-signal.ts so both platforms feed the same downstream pipeline."
```

---

### Task 3: Notion connector + wire persistence into cognitive-engine

**Files:**
- Create: `lib/platform-connectors/notion-connector.ts`
- Modify: `app/api/ai/cognitive-engine/route.ts:11,149-161` (add a parallel Notion persistence block; add the `evaluateNotionThresholds` and `persistNewPlatformSignals` imports — the latter already added in Task 1)

**Interfaces:**
- Consumes: `evaluateNotionThresholds`, `NotionChecklistItemLite` from Task 2's `lib/cognitive/notion-signal.ts`; `persistNewPlatformSignals` from Task 1's `lib/cognitive/platform-signals.ts`; `PlatformConnector`, `PlatformSignal` from `@/lib/platform-connectors/types`.
- Produces: `notionConnector: PlatformConnector` — not called from the cognitive-engine route directly (see below, same reasoning `google-calendar-connector.ts` documents for why Calendar's own connector isn't called from that route either), but available as the pattern any future generic multi-connector consumer plugs into.

- [ ] **Step 1: Create the connector**

Create `lib/platform-connectors/notion-connector.ts`:

```ts
// Second PlatformConnector implementation, mirroring
// google-calendar-connector.ts's shape. Reads ChecklistItem rows the
// existing Notion OAuth sync already wrote (app/api/integration/notion/
// route.ts) — no new API calls, no new auth.

import { prisma } from '@/lib/prisma';
import { evaluateNotionThresholds } from '@/lib/cognitive/notion-signal';
import type { PlatformConnector, PlatformSignal } from './types';

export const notionConnector: PlatformConnector = {
  async fetchSignals(userId: string): Promise<PlatformSignal[]> {
    const items = await prisma.checklistItem.findMany({
      where: { userId, source: 'notion' },
      select: { id: true, completed: true, priority: true, dueDate: true, updatedAt: true },
    });
    return evaluateNotionThresholds(items, new Date());
  },
};
```

- [ ] **Step 2: Add the Notion persistence block to the cognitive-engine route**

In `app/api/ai/cognitive-engine/route.ts`, add this import alongside the ones from Task 1's Step 7:

```ts
import { evaluateNotionThresholds } from '@/lib/cognitive/notion-signal';
```

Then, immediately after the existing Calendar persistence block (the `if (twinRecord && calendarSignal.connected) { ... }` block that now calls `persistNewPlatformSignals`), add:

```ts
    // Notion: same TwinEvolutionLog persistence path as Calendar above, but
    // no re-fetch needed — notionItems (fetched earlier in this route for
    // the task-list build) is already the exact shape evaluateNotionThresholds
    // needs, and it's pure computation over already-fetched data, not a
    // second network/API call the way Calendar's re-fetch is.
    if (twinRecord) {
      try {
        const notionThresholdSignals = evaluateNotionThresholds(notionItems, now);
        await persistNewPlatformSignals(twinRecord.id, userId, notionThresholdSignals);
      } catch {
        // Non-critical — the report itself doesn't depend on this succeeding.
      }
    }
```

- [ ] **Step 3: Typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit --incremental 2>&1 | grep -c "error TS"`
Expected: 70 (baseline, unchanged). If it's higher, check that `notionItems`' Prisma-inferred type (from the `Promise.all` in this route) is structurally compatible with `NotionChecklistItemLite` — it should be, since both have `{id: string, completed: boolean, priority: string, dueDate: Date | null, updatedAt: Date}` as a subset of `ChecklistItem`'s real fields.

- [ ] **Step 4: Manual verification**

This route only runs its persistence blocks on a true cache miss (see the `CACHE_TTL_MS` early-return above it) — same pre-existing behavior Calendar's block already has, not something this task changes. To verify manually: temporarily create 3+ overdue `ChecklistItem` rows with `source: 'notion'` for a test user (or use the demo-seeding approach from the Active Calendar Signal plan), hit `GET /api/ai/cognitive-engine` once (bypassing any cache — use a fresh account or wait out the 10-minute TTL), then check `TwinEvolutionLog` for a new `notion_overdue_accumulation` row.

- [ ] **Step 5: Commit**

```bash
git add lib/platform-connectors/notion-connector.ts app/api/ai/cognitive-engine/route.ts
git commit -m "feat(cognitive): wire Notion signal detection into the cognitive engine

Adds notionConnector (PlatformConnector) and a persistence block in the
cognitive-engine route, parallel to and independent of the existing
Calendar block."
```

---

### Task 4: Shared active-signal selection

**Files:**
- Create: `lib/cognitive/active-signal.ts`
- Create: `lib/cognitive/__tests__/active-signal.test.ts`

**Interfaces:**
- Produces: `ActiveSignal` type (`{ id: string; changeType: string; description: string; createdAt: Date; platform: 'notion' | 'calendar' }`) and `getActiveSignal(userId: string): Promise<ActiveSignal | null>`. Task 5 and Task 6 both import these by these exact names.
- Consumes: `prisma` from `@/lib/prisma`.

- [ ] **Step 1: Write the failing tests**

Create `lib/cognitive/__tests__/active-signal.test.ts`:

```ts
/// <reference types="jest" />
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    twinEvolutionLog: {
      findFirst: jest.fn(),
    },
  },
}));

import { getActiveSignal } from '../active-signal';

describe('getActiveSignal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the Notion signal when both a Notion and a Calendar signal exist today', async () => {
    (prisma.twinEvolutionLog.findFirst as jest.Mock).mockImplementation(({ where }: any) => {
      if (where.changeType.startsWith === 'notion_') {
        return Promise.resolve({
          id: 'n1', changeType: 'notion_overdue_accumulation',
          description: '3 tareas de Notion vencidas', createdAt: new Date(),
        });
      }
      return Promise.resolve({
        id: 'c1', changeType: 'calendar_meeting_overload',
        description: '3 reuniones seguidas', createdAt: new Date(),
      });
    });

    const result = await getActiveSignal('user-1');
    expect(result?.platform).toBe('notion');
    expect(result?.id).toBe('n1');
  });

  it('returns the Calendar signal when only a Calendar signal exists today', async () => {
    (prisma.twinEvolutionLog.findFirst as jest.Mock).mockImplementation(({ where }: any) => {
      if (where.changeType.startsWith === 'notion_') return Promise.resolve(null);
      return Promise.resolve({
        id: 'c1', changeType: 'calendar_meeting_overload',
        description: '3 reuniones seguidas', createdAt: new Date(),
      });
    });

    const result = await getActiveSignal('user-1');
    expect(result?.platform).toBe('calendar');
    expect(result?.id).toBe('c1');
  });

  it('returns null when neither signal exists today', async () => {
    (prisma.twinEvolutionLog.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await getActiveSignal('user-1');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `npx jest lib/cognitive/__tests__/active-signal.test.ts`
Expected: FAIL — `Cannot find module '../active-signal'`.

- [ ] **Step 3: Implement**

Create `lib/cognitive/active-signal.ts`:

```ts
// One shared "what's the active platform signal right now" reader, so the
// Ahora hero card and the AI chat context can never disagree about which
// signal to show. Priority: a Notion signal logged today wins over a
// Calendar signal logged today. (The ambient ToastInsight surface doesn't
// use this — it shows whatever TwinEvolutionLog entry is newest, regardless
// of type, which is the right behavior for a general activity feed.)

import { prisma } from '@/lib/prisma';

export interface ActiveSignal {
  id: string;
  changeType: string;
  description: string;
  createdAt: Date;
  platform: 'notion' | 'calendar';
}

export async function getActiveSignal(userId: string): Promise<ActiveSignal | null> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const notionSignal = await prisma.twinEvolutionLog.findFirst({
    where: { userId, changeType: { startsWith: 'notion_' }, createdAt: { gte: todayStart } },
    orderBy: { createdAt: 'desc' },
  });
  if (notionSignal) {
    return {
      id: notionSignal.id,
      changeType: notionSignal.changeType,
      description: notionSignal.description,
      createdAt: notionSignal.createdAt,
      platform: 'notion',
    };
  }

  const calendarSignal = await prisma.twinEvolutionLog.findFirst({
    where: { userId, changeType: { startsWith: 'calendar_' }, createdAt: { gte: todayStart } },
    orderBy: { createdAt: 'desc' },
  });
  if (calendarSignal) {
    return {
      id: calendarSignal.id,
      changeType: calendarSignal.changeType,
      description: calendarSignal.description,
      createdAt: calendarSignal.createdAt,
      platform: 'calendar',
    };
  }

  return null;
}
```

- [ ] **Step 4: Run to confirm it passes**

Run: `npx jest lib/cognitive/__tests__/active-signal.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit --incremental 2>&1 | grep -c "error TS"`
Expected: 70 (baseline, unchanged).

- [ ] **Step 6: Commit**

```bash
git add lib/cognitive/active-signal.ts lib/cognitive/__tests__/active-signal.test.ts
git commit -m "feat(cognitive): shared getActiveSignal across Calendar and Notion

One place decides which platform signal is 'the' active one today —
Notion wins over Calendar. Hero card, chat context, and any future
consumer all read through this instead of each computing their own
priority order."
```

---

### Task 5: New active-signal endpoint + now-hero.tsx update

**Files:**
- Create: `app/api/cognitive/active-signal/route.ts`
- Modify: `components/dashboard/now-hero.tsx` (full file is 159 lines; touches the imports, the `DecisionEntry` interface, the `useEffect` fetch, and the render's `showCalendarSignal`/`calendarSignal`/`linkHref` logic)
- Modify: `components/dashboard/__tests__/now-hero.test.tsx` (update the 3 existing tests' mocked URL and response shape)

**Interfaces:**
- Consumes: `getActiveSignal`, `ActiveSignal` from Task 4's `lib/cognitive/active-signal.ts`.
- Produces: `GET /api/cognitive/active-signal` returning `{ signal: ActiveSignal | null }` (with `createdAt` serialized to an ISO string by `NextResponse.json`, same as every other route in this codebase).

- [ ] **Step 1: Create the endpoint**

Create `app/api/cognitive/active-signal/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getActiveSignal } from '@/lib/cognitive/active-signal';

// GET /api/cognitive/active-signal — the one platform signal "Ahora →" and
// the AI chat context should show right now, already priority-resolved
// (Notion > Calendar) server-side.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const signal = await getActiveSignal(session.user.id);
  return NextResponse.json({ signal });
}
```

- [ ] **Step 2: Update now-hero.tsx's interfaces and fetch**

In `components/dashboard/now-hero.tsx`, replace the `DecisionEntry` interface (currently lines 18-23) with:

```ts
interface PlatformSignalEntry {
  id: string
  changeType: string
  description: string
  createdAt: string
  platform: 'notion' | 'calendar'
}
```

Remove the `isToday` helper function (currently lines 39-43) — it's no longer needed since the server now resolves "today" itself.

Replace the state declaration (currently line 56):

```ts
  const [calendarSignal, setCalendarSignal] = useState<DecisionEntry | null>(null)
```

with:

```ts
  const [platformSignal, setPlatformSignal] = useState<PlatformSignalEntry | null>(null)
```

Replace the `useEffect` body (currently lines 59-86) with:

```ts
  useEffect(() => {
    Promise.all([
      fetch('/api/tasks?status=todo').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/cognitive/active-signal').then((r) => (r.ok ? r.json() : { signal: null })),
    ])
      .then(([tasks, activeSignalResponse]: [TaskLite[], { signal: PlatformSignalEntry | null }]) => {
        const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 }
        const now = Date.now()
        const sorted = [...tasks].sort((a, b) => {
          const overdueA = a.dueDate && new Date(a.dueDate).getTime() < now ? 0 : 1
          const overdueB = b.dueDate && new Date(b.dueDate).getTime() < now ? 0 : 1
          if (overdueA !== overdueB) return overdueA - overdueB
          return (priorityRank[a.priority] ?? 3) - (priorityRank[b.priority] ?? 3)
        })
        const topTask = sorted[0] ?? null
        setTask(topTask)

        const isUrgentTask = !!topTask && (
          (!!topTask.dueDate && new Date(topTask.dueDate).getTime() < now) || topTask.priority === 'high'
        )
        if (!isUrgentTask) {
          setPlatformSignal(activeSignalResponse.signal)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])
```

- [ ] **Step 3: Update the render logic**

Replace (currently lines 100-104):

```ts
  // A calendar signal only preempts a task when that task isn't urgent — a non-urgent
  // task with no competing signal still beats onboarding/generic fallback copy.
  const showCalendarSignal = !isUrgentTask && !!calendarSignal
  const showTask = !!task && !showCalendarSignal
  const linkHref = showTask ? '/checklist' : showCalendarSignal ? '/calendar' : twin.energyCurve.chronotype ? '/checklist' : '/onboarding'
```

with:

```ts
  // A platform signal only preempts a task when that task isn't urgent — a non-urgent
  // task with no competing signal still beats onboarding/generic fallback copy.
  const showPlatformSignal = !isUrgentTask && !!platformSignal
  const showTask = !!task && !showPlatformSignal
  const linkHref = showTask
    ? '/checklist'
    : showPlatformSignal
      ? (platformSignal!.platform === 'notion' ? '/checklist' : '/calendar')
      : twin.energyCurve.chronotype ? '/checklist' : '/onboarding'
```

Replace the `showCalendarSignal` branch in the JSX (currently lines 124-130):

```tsx
          ) : showCalendarSignal ? (
            <>
              <h2 className="relative text-2xl md:text-4xl font-semibold tracking-tight mb-2 max-w-2xl">
                {calendarSignal!.description}
              </h2>
              <p className="relative text-sm md:text-base text-foreground/60">{phaseCopy}</p>
            </>
```

with:

```tsx
          ) : showPlatformSignal ? (
            <>
              <h2 className="relative text-2xl md:text-4xl font-semibold tracking-tight mb-2 max-w-2xl">
                {platformSignal!.description}
              </h2>
              <p className="relative text-sm md:text-base text-foreground/60">{phaseCopy}</p>
            </>
```

And the bottom link label (currently line 153):

```tsx
            {showTask ? 'Ir a la tarea' : showCalendarSignal ? 'Ver calendario' : 'Agregar tarea'} <ArrowRight className="w-3.5 h-3.5" />
```

with:

```tsx
            {showTask ? 'Ir a la tarea' : showPlatformSignal ? (platformSignal!.platform === 'notion' ? 'Ver tareas' : 'Ver calendario') : 'Agregar tarea'} <ArrowRight className="w-3.5 h-3.5" />
```

- [ ] **Step 4: Update the existing tests**

In `components/dashboard/__tests__/now-hero.test.tsx`, all 3 tests currently mock `url.includes('/api/cognitive/decisions')` returning an array. Update each to mock `url.includes('/api/cognitive/active-signal')` returning `{ signal: {...} }` instead of a bare array. For example, the first test's mock:

```ts
      if (url.includes('/api/cognitive/decisions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: '1', changeType: 'calendar_meeting_overload', description: '3 reuniones seguidas sin respiro hoy — considera un buffer.', createdAt: new Date().toISOString() },
          ]),
        });
      }
```

becomes:

```ts
      if (url.includes('/api/cognitive/active-signal')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            signal: { id: '1', changeType: 'calendar_meeting_overload', description: '3 reuniones seguidas sin respiro hoy — considera un buffer.', createdAt: new Date().toISOString(), platform: 'calendar' },
          }),
        });
      }
```

Apply the same transformation to the other two tests in that file (the "prefers an overdue task" test and the "prefers a calendar signal over a non-urgent task" test) — same shape change, same `platform: 'calendar'` field added. The test names, assertions, and `describe` block title (`'NowHero calendar override'`) stay as-is — these tests genuinely are about the calendar-signal-wins-over-non-urgent-task case, just via the new endpoint shape.

- [ ] **Step 5: Run the tests**

Run: `npx jest components/dashboard/__tests__/now-hero.test.tsx`
Expected: PASS (3/3).

- [ ] **Step 6: Typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit --incremental 2>&1 | grep -c "error TS"`
Expected: 70 (baseline, unchanged).

- [ ] **Step 7: Manual verification**

Run the dev server, load the dashboard as a user with a Calendar signal logged today and no urgent task — confirm the hero still shows it and links to `/calendar`. If feasible, also seed a Notion signal (see Task 3's manual-verification note) and confirm the hero prefers it (links to `/checklist`, shows the Notion message instead).

- [ ] **Step 8: Commit**

```bash
git add app/api/cognitive/active-signal/route.ts components/dashboard/now-hero.tsx components/dashboard/__tests__/now-hero.test.tsx
git commit -m "feat(dashboard): Ahora hero reads the shared active-signal endpoint

Replaces now-hero's own calendar-only decision-list filtering with the
priority-resolved /api/cognitive/active-signal endpoint, so it can show
Notion signals too, with Notion winning when both exist."
```

---

### Task 6: In-chat signal context

**Files:**
- Modify: `lib/ai/context-builder.ts` (add `activeSignal` to `CognitiveContext`, fetch it in `buildUserContext`, include it in both the success and fallback return paths)
- Modify: `app/api/ai/stream/route.ts:267` (add a conditional instruction line when `activeSignal` is present)

**Interfaces:**
- Consumes: `getActiveSignal`, `ActiveSignal` from Task 4's `lib/cognitive/active-signal.ts`.
- Produces: `CognitiveContext.activeSignal: ActiveSignal | null` — nothing downstream in this plan depends on it beyond the stream route's prompt assembly.

- [ ] **Step 1: Add the field to the `CognitiveContext` interface**

In `lib/ai/context-builder.ts`, add this import at the top (alongside the existing imports):

```ts
import { getActiveSignal, type ActiveSignal } from '@/lib/cognitive/active-signal';
```

Add `activeSignal: ActiveSignal | null;` as a new top-level field to the `CognitiveContext` interface (after the closing `}` of `preferences`, i.e. as a sibling of `system`/`todaySchedule`/`metrics`/`state`/`preferences`).

- [ ] **Step 2: Fetch it in `buildUserContext`**

Add `getActiveSignal(userId)` to the existing `Promise.all` array in `buildUserContext` (the one currently destructuring into `[settings, snapshot, taskCount, overdueTaskCount, routineCount, projectCount, todayEvents, tasksList, routinesList, projectsList]`) — append it as the 11th entry, and add a matching `activeSignal` name to the destructuring:

```ts
        const [
            settings,
            snapshot,
            taskCount,
            overdueTaskCount,
            routineCount,
            projectCount,
            todayEvents,
            tasksList,
            routinesList,
            projectsList,
            activeSignal
        ] = await Promise.all([
            // ...all 10 existing entries, unchanged...
            getActiveSignal(userId)
        ]);
```

Add `activeSignal,` to the `structuredContext` object literal (as a sibling of `system:`, `todaySchedule:`, etc.).

- [ ] **Step 3: Add it to the fallback path too**

In the `catch` block's `fallback` object, add `activeSignal: null,` (as a sibling of the other fallback fields) — so `CognitiveContext`'s shape is always complete even when the primary path throws.

- [ ] **Step 4: Add the prompt instruction**

In `app/api/ai/stream/route.ts`, immediately before the existing `const finalPrompt = ...` line (currently line 267), add:

```ts
        const activeSignalContext = context.structured.activeSignal
            ? `\n\nSEÑAL ACTIVA HOY: ${context.structured.activeSignal.description}\nMenciónala solo si es relevante para lo que el usuario te está preguntando ahora mismo — no la saques a colación si no viene al caso en esta conversación.`
            : '';
```

Then change the `finalPrompt` line from:

```ts
        const finalPrompt = `${selectedPrompt}\n\n${userContext}\n\n${timeCtx}${webSearchContext}`;
```

to:

```ts
        const finalPrompt = `${selectedPrompt}\n\n${userContext}\n\n${timeCtx}${webSearchContext}${activeSignalContext}`;
```

- [ ] **Step 5: Typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit --incremental 2>&1 | grep -c "error TS"`
Expected: 70 (baseline, unchanged).

- [ ] **Step 6: Manual verification**

With a signal active today (Calendar or Notion), open the chat and ask something unrelated (e.g. "¿qué es Novo?") — confirm the Twin's response doesn't mention the signal. Then ask something relevant (e.g. "¿qué debería hacer ahora?") — confirm it does reference the active signal's description.

- [ ] **Step 7: Commit**

```bash
git add lib/ai/context-builder.ts app/api/ai/stream/route.ts
git commit -m "feat(ai): include the active platform signal in chat context

The Twin can now reference today's active Calendar or Notion signal when
relevant to what the user is asking — instructed to stay quiet about it
otherwise, not to bring it up unprompted."
```

---

### Task 7: Full verification pass

**Files:** none (verification only, plus fixing anything it surfaces)

**Interfaces:** none.

- [ ] **Step 1: Full typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit --incremental 2>&1 | tee /tmp/tsc_final.txt | grep -c "error TS"`
Expected: 70 (baseline). Confirm none of the 70 are in any file this plan touched:

Run: `grep -E "cognitive/notion-signal|cognitive/active-signal|cognitive/platform-signals|cognitive/calendar-signal|platform-connectors/notion-connector|dashboard/now-hero|ai/context-builder|ai/cognitive-engine/route|ai/stream/route|cognitive/active-signal/route" /tmp/tsc_final.txt`
Expected: no output.

- [ ] **Step 2: Full relevant test run**

Run: `npx jest lib/cognitive components/dashboard/__tests__/now-hero.test.tsx`
Expected: all PASS.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual end-to-end verification**

If not already done via Task 3/5/6's manual-verification steps: seed 3+ overdue Notion-sourced `ChecklistItem` rows for a test account, trigger `GET /api/ai/cognitive-engine` once, and confirm — in this order — (a) a `notion_overdue_accumulation` row appears in `TwinEvolutionLog`, (b) the existing `TwinInsightToast` surfaces it on next page load (no code change needed there, just confirming the assumption holds), (c) the "Ahora →" hero shows it (assuming no urgent task exists), (d) asking the chat a relevant question surfaces it, an unrelated question doesn't.

- [ ] **Step 5: Fix anything surfaced by Steps 1-4**

If any check fails, fix it directly and re-run the failing check until it passes.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore(cognitive): verification pass for Notion signal + active surfacing"
```

(Only commit if Step 5 produced fixes — skip if everything passed clean on the first pass.)
