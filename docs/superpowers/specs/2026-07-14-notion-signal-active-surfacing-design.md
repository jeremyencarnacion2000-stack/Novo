# Notion Signal + Active Surfacing — Design Spec

## Context

This continues the "MCP externo (Novo activo)" sub-project — one of three
sub-projects decomposed from the user's original request to connect external
platforms so Novo actively assists users instead of passively waiting. The
first phase, **Active Calendar Signal**, already shipped: a generic
`PlatformConnector`/`PlatformSignal` interface (`lib/platform-connectors/types.ts`)
with `googleCalendarConnector` as the first implementation, wired into
`app/api/ai/cognitive-engine/route.ts` to detect calendar-density thresholds
and surface signals via the "Ahora →" hero card
(`components/dashboard/now-hero.tsx`).

Novo already has a **full, working, but passive** Notion integration: OAuth
connect/disconnect (`app/api/integration/notion/{connect,callback}/route.ts`),
and a manually-triggered sync (`app/api/integration/notion/route.ts`, `POST
?action=sync`) that upserts Notion database pages as `ChecklistItem` rows
(`source: 'notion'`). Nobody has built the active layer on top of it.

This phase adds that active layer for Notion, and — per user decision during
design review — also builds the two UI surfaces ("ambient toast" and
"in-chat, when asked") that were chosen for Active Calendar Signal but never
built in that phase. Both platforms get these surfaces at once, since the
work is shared infrastructure, not platform-specific.

## Goal

1. Detect three behavioral patterns in a user's synced Notion tasks and
   surface them the same way Calendar Signal surfaces its patterns.
2. Establish one shared, single source of truth for "what's the one active
   signal right now" across platforms, so the hero card, the toast, and the
   chat can never disagree.
3. Ship the ambient toast and in-chat-context surfaces that Active Calendar
   Signal's design called for but didn't build.

## Notion Signal Detection

**New file: `lib/platform-connectors/notion-connector.ts`** — a
`PlatformConnector` implementation (matching
`google-calendar-connector.ts`'s shape) that reads `ChecklistItem` rows where
`userId` matches and `source === 'notion'`. No new API calls, no new auth —
purely reads what the existing manual sync already wrote.

**New file: `lib/cognitive/notion-signal.ts`** (mirrors
`lib/cognitive/calendar-signal.ts`):

- `NotionSignal` type.
- `evaluateNotionThresholds()` — computes three patterns from the
  `ChecklistItem` rows:
  1. **Overdue accumulation**: ≥3 incomplete items with `dueDate` in the
     past.
  2. **Stagnation**: items created/updated in the last 7 days with zero
     completions in that window.
  3. **High-priority due soon**: an incomplete `priority: 'high'` item with
     `dueDate` within the next few hours.
- `persistNewNotionSignals()` — writes to `TwinEvolutionLog` with
  `changeType` values `notion_overdue_accumulation`, `notion_stagnation`,
  `notion_priority_due_soon`, using the same per-day dedup convention
  Calendar Signal already established (one row per `changeType` per
  calendar day).

**Known limitation (explicitly out of scope to fix here)**: Notion sync is
still manual/on-demand, so these signals reflect data as of the last sync,
not live Notion state. Improving sync freshness is a separate future
project.

`app/api/ai/cognitive-engine/route.ts` gets a new block calling
`evaluateNotionThresholds()` + `persistNewNotionSignals()`, parallel to and
independent of the existing Calendar block — each platform evaluates and
persists its own signals without depending on the other.

## Shared Active-Signal Selection

**New file: `lib/cognitive/active-signal.ts`**:

```
getActiveSignal(userId: string): Promise<ActiveSignal | null>
```

Queries today's `TwinEvolutionLog` rows for both `calendar_*` and `notion_*`
`changeType`s and returns the one to show, per priority:

1. (Handled by the caller, not this function) an urgent `Task` — due-passed
   or `priority: 'high'`.
2. A Notion signal logged today, if any exists.
3. Else a Calendar signal logged today, if any exists.
4. Else `null`.

The urgent-task check stays in `now-hero.tsx` exactly where it is today
(it's derived from the user's own `Task` rows, not a platform signal) —
`getActiveSignal` only arbitrates between platform signals, it doesn't
compute or know about tasks.

`now-hero.tsx` is updated to call `getActiveSignal` instead of its current
inline "only checks calendar" logic, keeping its existing render/priority
structure (`isUrgentTask` check first, then this function's result).

## Ambient Toast

- **New endpoint**: `GET /api/cognitive/active-signal` — thin wrapper
  returning `{ signal: ActiveSignal | null }` from `getActiveSignal`.
- **New file**: `components/signals/active-signal-toast.tsx` — a client
  component mounted once in `app/client-layout.tsx` alongside the existing
  `Toaster`. On mount, calls the endpoint; if there's a signal whose
  `{date, changeType}` isn't already recorded in `localStorage`, fires
  `toast()` (existing `sonner` infra) with the signal's message, then
  records it — so it shows once per new signal per day, never re-firing on
  navigation within the same day. No polling; checked once per full page
  load.

## In-Chat Signal Context

- `lib/ai/context-builder.ts`'s `buildUserContext()` calls
  `getActiveSignal(userId)` directly (server-side function call, no HTTP
  hop) and includes the result as `activeSignal` on the returned context
  object.
- Wherever the system prompt is assembled from that context (in
  `app/api/ai/stream/route.ts`), one line is added when `activeSignal` is
  present, instructing the model to mention it only if relevant to the
  user's actual question — never proactively bring it up unprompted in an
  unrelated conversation.

## Testing

- Jest unit tests for `evaluateNotionThresholds()`, mirroring
  `lib/cognitive/__tests__/calendar-signal.test.ts`'s structure and its
  learned date/timezone lesson: build test dates as real `Date` objects via
  `setHours()` and serialize with `.toISOString()` — never mix UTC-string
  slicing with no-timezone-suffix time strings.
- Jest unit tests for `getActiveSignal()`'s priority ordering: Notion signal
  present → Notion wins; only Calendar signal present → Calendar wins;
  neither present → `null`; a signal exists but not for today → not
  returned.
- Manual verification: toast fires once on load when a signal exists, does
  not re-fire on subsequent navigation same day; chat context — ask an
  unrelated question and confirm the Twin doesn't mention the signal, ask a
  relevant one and confirm it does.

## Rollout

Same pattern as Active Calendar Signal: subagent-driven-development in an
isolated worktree, typecheck → build → deploy → alias → `git push`, no
feature flag.
