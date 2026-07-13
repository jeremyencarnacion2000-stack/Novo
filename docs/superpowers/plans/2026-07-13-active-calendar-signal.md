# Active Calendar Signal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Novo's Cognitive Twin see the user's real Google Calendar and surface genuinely new scheduling problems (meeting overload, no free focus window, a meeting inside the user's peak window) through the Ahora hero, the Twin Insight Toast, and chat context — via a `PlatformConnector` interface designed so future platforms slot in without an architecture rewrite.

**Architecture:** A generic `PlatformConnector` interface (`fetchSignals(userId): Promise<PlatformSignal[]>`) with one implementation, `GoogleCalendarConnector`, that wraps the *already-working* `calendarService.listEvents()` (`lib/google.ts`). Signal-detection logic lives in a new shared `lib/cognitive/calendar-signal.ts`, extracted from `app/api/ai/cognitive-engine/route.ts` (unchanged behavior) plus new threshold-detection. New signals are persisted as `TwinEvolutionLog` rows (the same mechanism already powering the Bitácora and Twin Insight Toast), with a one-row-per-`changeType`-per-day dedup rule.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma/Postgres, Jest + `@testing-library/react`, existing `googleapis`-based `calendarService`.

## Global Constraints

- Reuse `calendarService.listEvents()` (`lib/google.ts:124`) exactly as-is — do not modify it.
- Reuse the existing `computeCalendarSignal()` logic unchanged when extracting it — this is a relocation, not a rewrite.
- `TwinEvolutionLog` writes always include `twinId`, `userId`, `changeType`, `description` — matching the exact shape already used in `lib/inngest/functions/process-twin-signal.ts:378-387`.
- No new Settings toggle, no new consent flow — the Google OAuth `calendar` scope is already granted at sign-in (`lib/auth.ts:392`).
- Autonomous *write* actions on Calendar, the generic MCP client, other platform connectors, and the landing redesign are explicitly out of scope — do not touch them.
- Copy must name the real thing ("3 reuniones seguidas"), never a clinical-sounding label ("Conflicto Detectado").
- Follow existing test conventions: pure-logic tests in `lib/**/__tests__/*.test.ts` mocking `@/lib/prisma` via `jest.mock`; component tests in `components/__tests__/*.test.tsx` using `@testing-library/react`.

---

### Task 1: Extract calendar signal computation into a shared module

**Files:**
- Create: `lib/cognitive/calendar-signal.ts`
- Create: `lib/cognitive/__tests__/calendar-signal.test.ts`
- Modify: `app/api/ai/cognitive-engine/route.ts:40-88` (remove the inline definitions, import from the new module instead)

**Interfaces:**
- Produces: `CalendarSignal` type, `WAKING_HOURS_START`/`WAKING_HOURS_END` constants, `computeCalendarSignal(events, now): CalendarSignal` — all with identical behavior to the code being moved.

- [ ] **Step 1: Create the shared module with the moved (unchanged) code**

Create `lib/cognitive/calendar-signal.ts`:

```ts
// Calendar signal: meeting density + biggest free block within waking hours.
// Extracted from app/api/ai/cognitive-engine/route.ts so both the cognitive
// engine's report generation and the PlatformConnector layer (see
// lib/platform-connectors/) can share one implementation instead of two.

export interface CalendarSignal {
  connected: boolean;
  meetingCount: number;
  meetingMinutesToday: number;
  largestFreeGapMinutes: number | null;
}

export const WAKING_HOURS_START = 7;
export const WAKING_HOURS_END = 22;

export function computeCalendarSignal(
  events: { start?: { dateTime?: string | null } | null; end?: { dateTime?: string | null } | null }[],
  now: Date
): CalendarSignal {
  const dayStart = new Date(now); dayStart.setHours(WAKING_HOURS_START, 0, 0, 0);
  const dayEnd = new Date(now); dayEnd.setHours(WAKING_HOURS_END, 0, 0, 0);

  // Only timed events count as "busy" — all-day events (date-only, no dateTime) don't block focus time.
  const busy = events
    .filter(e => e.start?.dateTime && e.end?.dateTime)
    .map(e => ({ start: new Date(e.start!.dateTime!), end: new Date(e.end!.dateTime!) }))
    .filter(e => e.end > dayStart && e.start < dayEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const meetingMinutesToday = Math.round(
    busy.reduce((acc, e) =>
      acc + (Math.min(e.end.getTime(), dayEnd.getTime()) - Math.max(e.start.getTime(), dayStart.getTime())), 0
    ) / 60000
  );

  let cursor = dayStart.getTime();
  let largestGapMs = 0;
  for (const e of busy) {
    const s = Math.max(e.start.getTime(), dayStart.getTime());
    if (s > cursor) largestGapMs = Math.max(largestGapMs, s - cursor);
    cursor = Math.max(cursor, Math.min(e.end.getTime(), dayEnd.getTime()));
  }
  if (dayEnd.getTime() > cursor) largestGapMs = Math.max(largestGapMs, dayEnd.getTime() - cursor);

  return {
    connected: true,
    meetingCount: busy.length,
    meetingMinutesToday,
    largestFreeGapMinutes: Math.round(largestGapMs / 60000),
  };
}
```

- [ ] **Step 2: Write the test proving the moved logic behaves identically**

Create `lib/cognitive/__tests__/calendar-signal.test.ts`:

```ts
/// <reference types="jest" />
import { computeCalendarSignal } from '../calendar-signal';

describe('computeCalendarSignal', () => {
  const now = new Date('2026-07-13T12:00:00');

  it('reports not connected as zeroed-out signal when given no events and connected is set by caller', () => {
    const result = computeCalendarSignal([], now);
    expect(result.meetingCount).toBe(0);
    expect(result.meetingMinutesToday).toBe(0);
    expect(result.largestFreeGapMinutes).toBe(15 * 60); // full 7:00-22:00 window free
  });

  it('counts timed events within waking hours and computes minutes busy', () => {
    const events = [
      { start: { dateTime: '2026-07-13T09:00:00' }, end: { dateTime: '2026-07-13T09:30:00' } },
      { start: { dateTime: '2026-07-13T10:00:00' }, end: { dateTime: '2026-07-13T11:00:00' } },
    ];
    const result = computeCalendarSignal(events, now);
    expect(result.meetingCount).toBe(2);
    expect(result.meetingMinutesToday).toBe(90);
  });

  it('ignores all-day events (no dateTime)', () => {
    const events = [
      { start: { date: '2026-07-13' } as any, end: { date: '2026-07-14' } as any },
    ];
    const result = computeCalendarSignal(events, now);
    expect(result.meetingCount).toBe(0);
  });

  it('computes the largest free gap correctly around a single meeting', () => {
    const events = [
      { start: { dateTime: '2026-07-13T09:00:00' }, end: { dateTime: '2026-07-13T09:30:00' } },
    ];
    const result = computeCalendarSignal(events, now);
    // Free from 07:00-09:00 (120 min) and 09:30-22:00 (750 min) — largest is 750
    expect(result.largestFreeGapMinutes).toBe(750);
  });
});
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `npx jest lib/cognitive/__tests__/calendar-signal.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 4: Update the cognitive-engine route to import from the shared module**

In `app/api/ai/cognitive-engine/route.ts`, delete lines 40-88 (the `CalendarSignal` interface, `WAKING_HOURS_START`/`WAKING_HOURS_END` constants, and `computeCalendarSignal` function — the block starting at the `// ─── Calendar signal:` comment and ending just before `export async function GET`).

Add this import near the top of the file, alongside the existing imports (after the `calendarService` import line):

```ts
import { computeCalendarSignal, type CalendarSignal } from '@/lib/cognitive/calendar-signal';
```

- [ ] **Step 5: Run the existing cognitive-engine tests to confirm no regression**

Run: `npx jest tests/cognitive-engine.test.ts`
Expected: PASS (same results as before this change — behavior is unchanged, only relocated)

- [ ] **Step 6: Commit**

```bash
git add lib/cognitive/calendar-signal.ts lib/cognitive/__tests__/calendar-signal.test.ts app/api/ai/cognitive-engine/route.ts
git commit -m "refactor: extract computeCalendarSignal into shared lib/cognitive module"
```

---

### Task 2: Add threshold-detection logic (the new intelligence)

**Files:**
- Create: `lib/platform-connectors/types.ts`
- Modify: `lib/cognitive/calendar-signal.ts` (add `evaluateCalendarThresholds`)
- Modify: `lib/cognitive/__tests__/calendar-signal.test.ts` (add tests)

**Interfaces:**
- Consumes: `CalendarSignal` (from Task 1).
- Produces: `PlatformSignal { type: string; headline: string; detail: string; severity: 'info' | 'warning' }`, `evaluateCalendarThresholds(events, signal, peakStart, peakEnd, now): PlatformSignal[]`.

- [ ] **Step 1: Create the shared signal type**

Create `lib/platform-connectors/types.ts`:

```ts
// Shared contract every platform integration returns through — the rest of
// the app (signal persistence, the Ahora hero, chat context) only ever sees
// PlatformSignal[], never a platform-specific shape. New platforms implement
// PlatformConnector; nothing downstream needs to change when one is added.

export interface PlatformSignal {
  type: string;
  headline: string;
  detail: string;
  severity: 'info' | 'warning';
}

export interface PlatformConnector {
  fetchSignals(userId: string): Promise<PlatformSignal[]>;
}
```

- [ ] **Step 2: Write the failing tests for the three thresholds**

Add to `lib/cognitive/__tests__/calendar-signal.test.ts` (append below the existing `describe` block, same file):

```ts
import { evaluateCalendarThresholds } from '../calendar-signal';

describe('evaluateCalendarThresholds', () => {
  const now = new Date('2026-07-13T12:00:00');

  it('returns no signals when not connected', () => {
    const signal = { connected: false, meetingCount: 0, meetingMinutesToday: 0, largestFreeGapMinutes: null };
    const result = evaluateCalendarThresholds([], signal, '09:00', '11:00', now);
    expect(result).toEqual([]);
  });

  it('flags meeting overload for 3+ consecutive events with <10 min gaps', () => {
    const events = [
      { start: { dateTime: '2026-07-13T09:00:00' }, end: { dateTime: '2026-07-13T09:30:00' } },
      { start: { dateTime: '2026-07-13T09:35:00' }, end: { dateTime: '2026-07-13T10:00:00' } },
      { start: { dateTime: '2026-07-13T10:05:00' }, end: { dateTime: '2026-07-13T10:30:00' } },
    ];
    const signal = { connected: true, meetingCount: 3, meetingMinutesToday: 85, largestFreeGapMinutes: 600 };
    const result = evaluateCalendarThresholds(events, signal, '14:00', '16:00', now);
    expect(result.find(s => s.type === 'calendar_meeting_overload')).toBeDefined();
    expect(result.find(s => s.type === 'calendar_meeting_overload')?.headline).toContain('3');
  });

  it('does not flag meeting overload when gaps are >= 10 min', () => {
    const events = [
      { start: { dateTime: '2026-07-13T09:00:00' }, end: { dateTime: '2026-07-13T09:30:00' } },
      { start: { dateTime: '2026-07-13T09:45:00' }, end: { dateTime: '2026-07-13T10:15:00' } },
      { start: { dateTime: '2026-07-13T10:30:00' }, end: { dateTime: '2026-07-13T11:00:00' } },
    ];
    const signal = { connected: true, meetingCount: 3, meetingMinutesToday: 90, largestFreeGapMinutes: 600 };
    const result = evaluateCalendarThresholds(events, signal, '14:00', '16:00', now);
    expect(result.find(s => s.type === 'calendar_meeting_overload')).toBeUndefined();
  });

  it('flags no real focus window when largest free gap is under 30 minutes', () => {
    const signal = { connected: true, meetingCount: 1, meetingMinutesToday: 800, largestFreeGapMinutes: 25 };
    const result = evaluateCalendarThresholds([], signal, '09:00', '11:00', now);
    expect(result.find(s => s.type === 'calendar_no_focus_window')).toBeDefined();
  });

  it('does not flag no-focus-window when the largest gap is 30 minutes or more', () => {
    const signal = { connected: true, meetingCount: 1, meetingMinutesToday: 60, largestFreeGapMinutes: 30 };
    const result = evaluateCalendarThresholds([], signal, '09:00', '11:00', now);
    expect(result.find(s => s.type === 'calendar_no_focus_window')).toBeUndefined();
  });

  it('flags a peak-window conflict when an event overlaps the declared peak window', () => {
    const events = [
      { start: { dateTime: '2026-07-13T09:30:00' }, end: { dateTime: '2026-07-13T10:00:00' } },
    ];
    const signal = { connected: true, meetingCount: 1, meetingMinutesToday: 30, largestFreeGapMinutes: 600 };
    const result = evaluateCalendarThresholds(events, signal, '09:00', '11:00', now);
    expect(result.find(s => s.type === 'calendar_peak_conflict')).toBeDefined();
  });

  it('does not flag a peak-window conflict when no event overlaps it', () => {
    const events = [
      { start: { dateTime: '2026-07-13T13:00:00' }, end: { dateTime: '2026-07-13T13:30:00' } },
    ];
    const signal = { connected: true, meetingCount: 1, meetingMinutesToday: 30, largestFreeGapMinutes: 600 };
    const result = evaluateCalendarThresholds(events, signal, '09:00', '11:00', now);
    expect(result.find(s => s.type === 'calendar_peak_conflict')).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest lib/cognitive/__tests__/calendar-signal.test.ts`
Expected: FAIL with "evaluateCalendarThresholds is not a function" (or similar — the function doesn't exist yet)

- [ ] **Step 4: Implement `evaluateCalendarThresholds`**

Append to `lib/cognitive/calendar-signal.ts` (add this import at the top of the file first: `import type { PlatformSignal } from '@/lib/platform-connectors/types';`):

```ts
export function evaluateCalendarThresholds(
  events: { start?: { dateTime?: string | null } | null; end?: { dateTime?: string | null } | null }[],
  signal: CalendarSignal,
  peakStart: string,
  peakEnd: string,
  now: Date
): PlatformSignal[] {
  const results: PlatformSignal[] = [];
  if (!signal.connected) return results;

  const busy = events
    .filter(e => e.start?.dateTime && e.end?.dateTime)
    .map(e => ({ start: new Date(e.start!.dateTime!), end: new Date(e.end!.dateTime!) }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  // Meeting overload: a run of 3+ consecutive events where every gap < 10 min.
  let runLength = busy.length > 0 ? 1 : 0;
  let maxRun = runLength;
  for (let i = 1; i < busy.length; i++) {
    const gapMinutes = (busy[i].start.getTime() - busy[i - 1].end.getTime()) / 60000;
    if (gapMinutes < 10) {
      runLength += 1;
      maxRun = Math.max(maxRun, runLength);
    } else {
      runLength = 1;
    }
  }
  if (maxRun >= 3) {
    results.push({
      type: 'calendar_meeting_overload',
      headline: `${maxRun} reuniones seguidas sin respiro hoy`,
      detail: 'Considera un buffer de 10 minutos entre reuniones para no llegar agotado a la siguiente.',
      severity: 'warning',
    });
  }

  // No real focus window: largest free gap under 30 minutes.
  if (signal.largestFreeGapMinutes !== null && signal.largestFreeGapMinutes < 30) {
    results.push({
      type: 'calendar_no_focus_window',
      headline: `Hoy tu hueco más grande es de ${signal.largestFreeGapMinutes} min`,
      detail: 'No hay espacio real para trabajo profundo hoy — considera mover algo de baja prioridad.',
      severity: 'warning',
    });
  }

  // Peak-window conflict: any event overlaps the user's declared peak focus window.
  const [peakStartH, peakStartM] = peakStart.split(':').map(Number);
  const [peakEndH, peakEndM] = peakEnd.split(':').map(Number);
  const peakStartDate = new Date(now); peakStartDate.setHours(peakStartH, peakStartM || 0, 0, 0);
  const peakEndDate = new Date(now); peakEndDate.setHours(peakEndH, peakEndM || 0, 0, 0);
  const conflict = busy.find(e => e.start < peakEndDate && e.end > peakStartDate);
  if (conflict) {
    results.push({
      type: 'calendar_peak_conflict',
      headline: `Una reunión cae dentro de tu ventana pico (${peakStart}–${peakEnd})`,
      detail: 'Vale la pena revisar si esa hora es realmente necesaria para la reunión.',
      severity: 'info',
    });
  }

  return results;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest lib/cognitive/__tests__/calendar-signal.test.ts`
Expected: PASS (11 tests total — 4 from Task 1 + 7 new)

- [ ] **Step 6: Commit**

```bash
git add lib/platform-connectors/types.ts lib/cognitive/calendar-signal.ts lib/cognitive/__tests__/calendar-signal.test.ts
git commit -m "feat: add PlatformSignal type and calendar threshold detection"
```

---

### Task 3: `GoogleCalendarConnector` — the reusable platform integration

**Files:**
- Create: `lib/platform-connectors/google-calendar-connector.ts`
- Create: `lib/platform-connectors/__tests__/google-calendar-connector.test.ts`

**Interfaces:**
- Consumes: `calendarService.listEvents(timeMin, maxResults, timeMax)` (`lib/google.ts:124`, unchanged), `computeCalendarSignal`/`evaluateCalendarThresholds` (Tasks 1-2), `prisma.cognitiveTwinRecord.findUnique`.
- Produces: `googleCalendarConnector: PlatformConnector` — the first real implementation of the interface from Task 2.

- [ ] **Step 1: Write the failing test**

Create `lib/platform-connectors/__tests__/google-calendar-connector.test.ts`:

```ts
/// <reference types="jest" />
import { googleCalendarConnector } from '../google-calendar-connector';
import { calendarService } from '@/lib/google';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/google', () => ({
  calendarService: { listEvents: jest.fn() },
}));

jest.mock('@/lib/prisma', () => ({
  prisma: { cognitiveTwinRecord: { findUnique: jest.fn() } },
}));

describe('googleCalendarConnector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns signals derived from real calendar events and the twin peak window', async () => {
    (calendarService.listEvents as jest.Mock).mockResolvedValue([
      { start: { dateTime: '2026-07-13T09:00:00' }, end: { dateTime: '2026-07-13T09:30:00' } },
      { start: { dateTime: '2026-07-13T09:35:00' }, end: { dateTime: '2026-07-13T10:00:00' } },
      { start: { dateTime: '2026-07-13T10:05:00' }, end: { dateTime: '2026-07-13T10:30:00' } },
    ]);
    (prisma.cognitiveTwinRecord.findUnique as jest.Mock).mockResolvedValue({
      id: 'twin-1',
      energyCurve: { peakFocusStart: '09:00', peakFocusEnd: '11:00' },
    });

    const signals = await googleCalendarConnector.fetchSignals('user-1');

    expect(signals.length).toBeGreaterThan(0);
    expect(signals.some(s => s.type === 'calendar_meeting_overload')).toBe(true);
  });

  it('returns an empty array when the Google API call fails (not connected)', async () => {
    (calendarService.listEvents as jest.Mock).mockRejectedValue(new Error('no token'));
    (prisma.cognitiveTwinRecord.findUnique as jest.Mock).mockResolvedValue(null);

    const signals = await googleCalendarConnector.fetchSignals('user-1');

    expect(signals).toEqual([]);
  });

  it('falls back to default peak window when the twin has none set', async () => {
    (calendarService.listEvents as jest.Mock).mockResolvedValue([]);
    (prisma.cognitiveTwinRecord.findUnique as jest.Mock).mockResolvedValue({ id: 'twin-1', energyCurve: {} });

    const signals = await googleCalendarConnector.fetchSignals('user-1');

    expect(signals).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest lib/platform-connectors/__tests__/google-calendar-connector.test.ts`
Expected: FAIL with "Cannot find module '../google-calendar-connector'"

- [ ] **Step 3: Implement the connector**

Create `lib/platform-connectors/google-calendar-connector.ts`:

```ts
// First real PlatformConnector implementation. Wraps the already-working
// calendarService (lib/google.ts) behind the generic PlatformConnector
// contract, so future platforms (which may connect via MCP instead of a
// direct API) slot in without anything downstream changing.

import { calendarService } from '@/lib/google';
import { prisma } from '@/lib/prisma';
import { computeCalendarSignal, evaluateCalendarThresholds } from '@/lib/cognitive/calendar-signal';
import type { PlatformConnector, PlatformSignal } from './types';

const DEFAULT_PEAK_START = '09:00';
const DEFAULT_PEAK_END = '11:00';

export const googleCalendarConnector: PlatformConnector = {
  async fetchSignals(userId: string): Promise<PlatformSignal[]> {
    try {
      const now = new Date();
      const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const events = await calendarService.listEvents(dayStart.toISOString(), 50, dayEnd.toISOString());
      const signal = computeCalendarSignal(events as any, now);

      const twinRecord = await prisma.cognitiveTwinRecord.findUnique({ where: { userId } });
      const energyCurve = (twinRecord?.energyCurve as any) || {};
      const peakStart = energyCurve.peakFocusStart || DEFAULT_PEAK_START;
      const peakEnd = energyCurve.peakFocusEnd || DEFAULT_PEAK_END;

      return evaluateCalendarThresholds(events as any, signal, peakStart, peakEnd, now);
    } catch {
      // Not connected via Google, or the API call failed — no signals this run.
      return [];
    }
  },
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest lib/platform-connectors/__tests__/google-calendar-connector.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/platform-connectors/google-calendar-connector.ts lib/platform-connectors/__tests__/google-calendar-connector.test.ts
git commit -m "feat: add GoogleCalendarConnector, the first PlatformConnector implementation"
```

---

### Task 4: Fix the broken `/calendar` page — real Google events instead of `[]`

**Files:**
- Modify: `lib/calendar-aggregator.ts:155-167`
- Create: `lib/__tests__/calendar-aggregator.test.ts`

**Interfaces:**
- Consumes: `calendarService.listEvents` (`lib/google.ts`, unchanged).
- Produces: `CalendarAggregator.getEventsForRange(userId, start, end, ['google'])` now returns real events instead of always `[]`. This also fixes `buildUserContext()` (`lib/ai/context-builder.ts:77`) for free, since it already calls `CalendarAggregator.getEventsForRange` — no change needed there.

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/calendar-aggregator.test.ts`:

```ts
/// <reference types="jest" />
import { CalendarAggregator } from '../calendar-aggregator';
import { calendarService } from '@/lib/google';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/google', () => ({
  calendarService: { listEvents: jest.fn() },
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    checklistItem: { findMany: jest.fn().mockResolvedValue([]) },
    project: { findMany: jest.fn().mockResolvedValue([]) },
    course: { findMany: jest.fn().mockResolvedValue([]) },
    routine: { findMany: jest.fn().mockResolvedValue([]) },
    tracker: { findMany: jest.fn().mockResolvedValue([]) },
    deal: { findMany: jest.fn().mockResolvedValue([]) },
    calendarEvent: { findMany: jest.fn().mockResolvedValue([]) },
  },
}));

describe('CalendarAggregator google events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps real Google Calendar API events into CalendarEvent shape', async () => {
    (calendarService.listEvents as jest.Mock).mockResolvedValue([
      {
        id: 'abc123',
        summary: 'Team sync',
        start: { dateTime: '2026-07-13T09:00:00' },
        end: { dateTime: '2026-07-13T09:30:00' },
      },
    ]);

    const start = new Date('2026-07-13T00:00:00');
    const end = new Date('2026-07-13T23:59:59');
    const events = await CalendarAggregator.getEventsForRange('user-1', start, end, ['google']);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: 'google:event:abc123',
      title: 'Team sync',
      allDay: false,
      source: 'google',
    });
  });

  it('returns an empty array when Google is not connected (API call fails)', async () => {
    (calendarService.listEvents as jest.Mock).mockRejectedValue(new Error('no token'));

    const start = new Date('2026-07-13T00:00:00');
    const end = new Date('2026-07-13T23:59:59');
    const events = await CalendarAggregator.getEventsForRange('user-1', start, end, ['google']);

    expect(events).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest lib/__tests__/calendar-aggregator.test.ts`
Expected: FAIL — `events` is `[]` in the first test (current stub always returns `[]`), so `toHaveLength(1)` fails.

- [ ] **Step 3: Implement the fix**

In `lib/calendar-aggregator.ts`, add this import near the top of the file (alongside the existing `date-fns` import):

```ts
import { calendarService } from './google';
```

Replace the `getGoogleEvents` method (lines 155-167):

```ts
    /**
     * Get Google Calendar events
     */
    private static async getGoogleEvents(
        userId: string,
        start: Date,
        end: Date
    ): Promise<CalendarEvent[]> {
        try {
            const events = await calendarService.listEvents(start.toISOString(), 50, end.toISOString());
            return events
                .filter((e: any) => e.start?.dateTime || e.start?.date)
                .map((e: any) => {
                    const isAllDay = !e.start?.dateTime;
                    return {
                        id: `google:event:${e.id}`,
                        title: e.summary || '(Sin título)',
                        start: new Date(e.start.dateTime || e.start.date),
                        end: new Date(e.end.dateTime || e.end.date),
                        allDay: isAllDay,
                        source: 'google' as const,
                        color: SOURCE_COLORS.google,
                        metadata: {
                            description: e.description || undefined,
                        },
                    };
                });
        } catch {
            // Not connected via Google, or the token/API call failed — no Google events this run.
            return [];
        }
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest lib/__tests__/calendar-aggregator.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Manual verification against the real page**

Run: `npm run dev` (or use the deployed environment), sign in with a Google account that has real calendar events today, open `/calendar`.
Expected: real Google events appear on the calendar (previously always empty for the "google" source).

- [ ] **Step 6: Commit**

```bash
git add lib/calendar-aggregator.ts lib/__tests__/calendar-aggregator.test.ts
git commit -m "fix: getGoogleEvents was a stub always returning [] — wire it to the real Calendar API"
```

---

### Task 5: Persist new signals as `TwinEvolutionLog` rows, with anti-spam dedup

**Files:**
- Modify: `lib/cognitive/calendar-signal.ts` (add `persistNewCalendarSignals`)
- Modify: `lib/cognitive/__tests__/calendar-signal.test.ts` (add tests)
- Modify: `app/api/ai/cognitive-engine/route.ts` (call it after the existing calendar signal computation)

**Interfaces:**
- Consumes: `PlatformSignal[]` (Task 2), `prisma.twinEvolutionLog.findFirst`/`.create`.
- Produces: `persistNewCalendarSignals(twinId, userId, signals): Promise<void>` — writes at most one row per `changeType` per calendar day.

- [ ] **Step 1: Write the failing tests**

Add to `lib/cognitive/__tests__/calendar-signal.test.ts` (append; add `import { prisma } from '@/lib/prisma';` and the `jest.mock('@/lib/prisma', ...)` block at the top of the file, above the existing imports):

```ts
import { persistNewCalendarSignals } from '../calendar-signal';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    twinEvolutionLog: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

describe('persistNewCalendarSignals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes a new TwinEvolutionLog row when none exists today for that changeType', async () => {
    (prisma.twinEvolutionLog.findFirst as jest.Mock).mockResolvedValue(null);

    await persistNewCalendarSignals('twin-1', 'user-1', [
      { type: 'calendar_meeting_overload', headline: '3 reuniones seguidas', detail: 'detalle', severity: 'warning' },
    ]);

    expect(prisma.twinEvolutionLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        twinId: 'twin-1',
        userId: 'user-1',
        changeType: 'calendar_meeting_overload',
      }),
    });
  });

  it('does not write a duplicate row when one already exists today for that changeType', async () => {
    (prisma.twinEvolutionLog.findFirst as jest.Mock).mockResolvedValue({ id: 'existing-row' });

    await persistNewCalendarSignals('twin-1', 'user-1', [
      { type: 'calendar_meeting_overload', headline: '3 reuniones seguidas', detail: 'detalle', severity: 'warning' },
    ]);

    expect(prisma.twinEvolutionLog.create).not.toHaveBeenCalled();
  });

  it('does nothing when there are no signals', async () => {
    await persistNewCalendarSignals('twin-1', 'user-1', []);
    expect(prisma.twinEvolutionLog.findFirst).not.toHaveBeenCalled();
    expect(prisma.twinEvolutionLog.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest lib/cognitive/__tests__/calendar-signal.test.ts`
Expected: FAIL with "persistNewCalendarSignals is not a function"

- [ ] **Step 3: Implement `persistNewCalendarSignals`**

Append to `lib/cognitive/calendar-signal.ts` (add `import { prisma } from '@/lib/prisma';` at the top of the file):

```ts
export async function persistNewCalendarSignals(
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

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest lib/cognitive/__tests__/calendar-signal.test.ts`
Expected: PASS (14 tests total)

- [ ] **Step 5: Wire it into the cognitive-engine route**

In `app/api/ai/cognitive-engine/route.ts`, update the import from Task 1 to also bring in the new functions:

```ts
import { computeCalendarSignal, evaluateCalendarThresholds, persistNewCalendarSignals, type CalendarSignal } from '@/lib/cognitive/calendar-signal';
```

Find this exact block (unchanged from Task 1 — the route's own calendar signal computation, used for the LLM prompt):

```ts
    try {
      const dayEndIso = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000).toISOString();
      const events = await calendarService.listEvents(todayStart.toISOString(), 50, dayEndIso);
      calendarSignal = computeCalendarSignal(events as any, now);
    } catch {
      // Not connected, or the Google API call failed — no calendar signal this run.
    }
```

Immediately after its closing `}`, add:

```ts
    // New scheduling problems worth surfacing get written to TwinEvolutionLog —
    // the same mechanism already powering the Bitácora and Twin Insight Toast.
    // persistNewCalendarSignals dedupes per changeType per day on its own.
    //
    // This re-fetches events and re-derives the signal via its own try/catch
    // rather than reusing the `events`/`calendarSignal` locals above, so a
    // failure here can never affect the prompt-generation path above it.
    // GoogleCalendarConnector (Task 3) is not called from here directly —
    // this route already has the raw calendarService/computeCalendarSignal
    // building blocks in scope, so calling the connector wrapper would mean
    // fetching Google Calendar twice in the same request. The connector
    // exists as the proven, reusable pattern for the *next* platform that
    // doesn't already have this data sitting in scope.
    if (twinRecord && calendarSignal.connected) {
      try {
        const dayEndIso = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000).toISOString();
        const events = await calendarService.listEvents(todayStart.toISOString(), 50, dayEndIso);
        const energyCurve = (twinRecord.energyCurve as any) || {};
        const peakStart = energyCurve.peakFocusStart || '09:00';
        const peakEnd = energyCurve.peakFocusEnd || '11:00';
        const thresholdSignals = evaluateCalendarThresholds(events as any, calendarSignal, peakStart, peakEnd, now);
        await persistNewCalendarSignals(twinRecord.id, userId, thresholdSignals);
      } catch {
        // Non-critical — the report itself doesn't depend on this succeeding.
      }
    }
```

- [ ] **Step 6: Run the existing cognitive-engine tests to confirm no regression**

Run: `npx jest tests/cognitive-engine.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/cognitive/calendar-signal.ts lib/cognitive/__tests__/calendar-signal.test.ts app/api/ai/cognitive-engine/route.ts
git commit -m "feat: persist new calendar signals to TwinEvolutionLog with per-day dedup"
```

---

### Task 6: Surface calendar signals in the Ahora hero

**Files:**
- Modify: `components/dashboard/now-hero.tsx`
- Create: `components/dashboard/__tests__/now-hero.test.tsx`

**Interfaces:**
- Consumes: `GET /api/cognitive/decisions` (existing endpoint, `app/api/cognitive/decisions/route.ts` — returns `{ id, changeType, description, createdAt }[]`, newest first).
- Produces: the Ahora hero shows a calendar-derived headline when a `calendar_*` signal was logged today and no overdue/high-priority task exists; otherwise falls back to the existing task/onboarding logic (unchanged).

- [ ] **Step 1: Write the failing test**

Create `components/dashboard/__tests__/now-hero.test.tsx`:

```tsx
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { NowHero } from '../now-hero'

jest.mock('@/lib/cognitive-twin-context', () => ({
  useCognitiveTwin: () => ({
    twin: {
      energyCurve: { chronotype: 'morning_lark', peakFocusStart: '07:00', peakFocusEnd: '10:00' },
      bottlenecks: { mainFrictionPoint: 'procrastination' },
    },
  }),
}))

jest.mock('@/lib/cognitive-context', () => ({
  useCognitivePhase: () => 'LINEAR_EXECUTION',
}))

describe('NowHero calendar override', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('shows a calendar signal headline when no urgent task exists but a calendar signal was logged today', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/tasks')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/api/cognitive/decisions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: '1', changeType: 'calendar_meeting_overload', description: '3 reuniones seguidas sin respiro hoy — considera un buffer.', createdAt: new Date().toISOString() },
          ]),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<NowHero />)

    await waitFor(() => {
      expect(screen.getByText(/3 reuniones seguidas/i)).toBeInTheDocument()
    })
  });

  it('prefers an overdue task over a calendar signal', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/tasks')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 't1', title: 'Tarea vencida importante', priority: 'high', dueDate: '2020-01-01' },
          ]),
        });
      }
      if (url.includes('/api/cognitive/decisions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: '1', changeType: 'calendar_meeting_overload', description: '3 reuniones seguidas.', createdAt: new Date().toISOString() },
          ]),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<NowHero />)

    await waitFor(() => {
      expect(screen.getByText('Tarea vencida importante')).toBeInTheDocument()
    })
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest components/dashboard/__tests__/now-hero.test.tsx`
Expected: FAIL — the first test can't find the calendar signal text (the hero doesn't fetch `/api/cognitive/decisions` yet)

- [ ] **Step 3: Implement the calendar override in `now-hero.tsx`**

Replace the full contents of `components/dashboard/now-hero.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { useCognitiveTwin } from '@/lib/cognitive-twin-context'
import { useCognitivePhase } from '@/lib/cognitive-context'
import { springConfig } from '@/lib/design-tokens'

interface TaskLite {
  id: string
  title: string
  priority: string
  dueDate: string | null
}

interface DecisionEntry {
  id: string
  changeType: string
  description: string
  createdAt: string
}

const PHASE_COPY: Record<string, string> = {
  PEAK_FOCUS: 'Tu ventana de máximo enfoque está abierta.',
  LINEAR_EXECUTION: 'Buen momento para ejecutar con constancia.',
  SYNAPTIC_FATIGUE: 'Tu energía está baja ahora mismo — ve con calma.',
  REDUCED_CAPACITY_MODE: 'Capacidad reducida ahora mismo — un paso pequeño basta.',
}

const FRICTION_TIP: Record<string, string> = {
  procrastination: 'Empieza con el paso más pequeño posible — solo 2 minutos.',
  context_switching: 'Cierra todo lo demás y quédate en una sola cosa.',
  overcommitment: 'Elige solo UNA cosa. Lo demás espera.',
  lack_of_structure: 'Bloquea 25 minutos ahora mismo, sin más planeación.',
}

function isToday(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

// The single decision that replaces the old cold-start card, which fabricated
// clinical-sounding claims ("Impaired Sleep Debt Detected") for brand-new
// accounts with zero real signal. Priority order: an overdue or high-priority
// task wins (most concrete and actionable); otherwise a real calendar signal
// logged today (e.g. meeting overload) takes over; otherwise the user's own
// onboarding answers, framed honestly as "según nos dijiste" — never a
// "detected" pattern.
export function NowHero() {
  const { twin } = useCognitiveTwin()
  const phase = useCognitivePhase()
  const [task, setTask] = useState<TaskLite | null>(null)
  const [calendarSignal, setCalendarSignal] = useState<DecisionEntry | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/tasks?status=todo').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/cognitive/decisions').then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([tasks, decisions]: [TaskLite[], DecisionEntry[]]) => {
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
          const todaysCalendarSignal = decisions.find((d) => d.changeType.startsWith('calendar_') && isToday(d.createdAt))
          setCalendarSignal(todaysCalendarSignal ?? null)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const phaseCopy = PHASE_COPY[phase] ?? PHASE_COPY.LINEAR_EXECUTION
  const isOverdue = !!task?.dueDate && new Date(task.dueDate).getTime() < Date.now()
  const frictionTip = twin.bottlenecks.mainFrictionPoint
    ? FRICTION_TIP[twin.bottlenecks.mainFrictionPoint]
    : null

  if (loading) {
    return <div className="h-48 rounded-[28px] bg-foreground/[0.03] animate-pulse" />
  }

  const showCalendarSignal = !task && !!calendarSignal
  const linkHref = task ? '/checklist' : showCalendarSignal ? '/calendar' : twin.energyCurve.chronotype ? '/checklist' : '/onboarding'

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={springConfig.smooth}>
      <Link href={linkHref} className="block group">
        <div className="relative rounded-[28px] p-8 md:p-10 border border-primary/25 bg-gradient-to-br from-primary/[0.10] via-primary/[0.03] to-transparent overflow-hidden transition-all duration-300 hover:border-primary/40">
          <div
            className="absolute -top-10 -right-10 w-56 h-56 rounded-full opacity-20 blur-3xl pointer-events-none transition-opacity duration-500 group-hover:opacity-30"
            style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }}
          />
          <p className="relative text-[11px] font-black tracking-[0.25em] uppercase text-primary/70 mb-3">Ahora →</p>

          {task ? (
            <>
              <h2 className="relative text-2xl md:text-4xl font-semibold tracking-tight mb-2 max-w-2xl">{task.title}</h2>
              <p className="relative text-sm md:text-base text-foreground/60">
                {phaseCopy}
                {isOverdue && <span className="text-red-400 font-medium"> · vencida</span>}
              </p>
            </>
          ) : showCalendarSignal ? (
            <>
              <h2 className="relative text-2xl md:text-4xl font-semibold tracking-tight mb-2 max-w-2xl">
                {calendarSignal!.description}
              </h2>
              <p className="relative text-sm md:text-base text-foreground/60">{phaseCopy}</p>
            </>
          ) : twin.energyCurve.chronotype ? (
            <>
              <h2 className="relative text-2xl md:text-4xl font-semibold tracking-tight mb-2 max-w-2xl">
                {frictionTip ?? 'Agrega tu primera tarea para que el Twin empiece a aprender.'}
              </h2>
              <p className="relative text-sm md:text-base text-foreground/60">
                {phaseCopy}
                {twin.energyCurve.peakFocusStart && (
                  <> · tu ventana pico, según nos dijiste, es {twin.energyCurve.peakFocusStart}–{twin.energyCurve.peakFocusEnd}</>
                )}
              </p>
            </>
          ) : (
            <>
              <h2 className="relative text-2xl md:text-4xl font-semibold tracking-tight mb-2 max-w-2xl">
                Agrega tu primera tarea para que el Twin empiece a aprender.
              </h2>
              <p className="relative text-sm md:text-base text-foreground/60">{phaseCopy}</p>
            </>
          )}

          <div className="relative mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-primary group-hover:gap-2.5 transition-all duration-300">
            {task ? 'Ir a la tarea' : showCalendarSignal ? 'Ver calendario' : 'Agregar tarea'} <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest components/dashboard/__tests__/now-hero.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Run the full test suite to confirm no regressions anywhere**

Run: `npx jest`
Expected: PASS (all suites, including every test added in Tasks 1-6)

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/now-hero.tsx components/dashboard/__tests__/now-hero.test.tsx
git commit -m "feat: surface calendar signals in the Ahora hero when no urgent task exists"
```

---

## Final verification (after all 6 tasks)

- [ ] Run `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit --incremental` — confirm the error count matches the pre-existing baseline (no new errors introduced).
- [ ] Run `npm run build` — confirm a clean production build.
- [ ] Manual check: sign in with a Google account with real calendar events, confirm `/calendar` shows them, confirm the Twin Insight Toast fires for a synthetic overload day, confirm the Ahora hero shows the calendar signal when no urgent task exists, confirm chat correctly answers "¿qué tengo hoy?".
