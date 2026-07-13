# Active Calendar Signal — Design Spec

**Date:** 2026-07-13
**Status:** Approved (pending user confirmation of this written doc)

## Problem

Novo's core promise is a Cognitive Twin that answers "what should you do right now" — but today that answer only ever looks *inward*, at data created inside Novo itself (tasks, focus sessions, routines). The user's real day includes commitments that live outside Novo: meetings, deadlines, conflicts. Without that signal, Novo is passive — it can't warn you about a day that's about to go sideways, only report on what already happened inside the app.

This spec is the first step toward an "active, not passive" Twin: real Google Calendar data feeding the three surfaces built this session (the "Ahora →" hero, the ambient Twin Insight Toast, and chat context), via an integration architecture designed to scale to future platforms (Notion, Slack, etc.) without a rewrite each time.

This is the first of three related projects (decomposed explicitly to avoid one muddled spec):
1. **This spec** — active Calendar signal via a generic, MCP-ready connector architecture.
2. *(separate spec, later)* Twin exposed as an MCP tool for Novo's own chatbot + a premium toggle in the chat input.
3. *(separate project, later)* Landing page visual redesign.

## Context discovered during design

- Every signed-in Google user's OAuth token **already includes** the `https://www.googleapis.com/auth/calendar` scope (`lib/auth.ts`) — no new consent flow needed.
- `lib/google.ts`'s `calendarService.listEvents()` **already works** — it's called today by `app/api/ai/cognitive-engine/route.ts` to compute `computeCalendarSignal()` (meeting count, meeting minutes, largest free gap). This logic is reused, not rebuilt.
- That computed signal currently only feeds an LLM prompt for the report narrative and the raw API response — it never reaches the "Ahora →" hero, the Twin Insight Toast, or chat context (all built earlier this same session).
- `lib/calendar-aggregator.ts`'s `getGoogleEvents()` (powers the `/calendar` page's "google" event source) is a stub that has always returned `[]` — a real, separate, silent bug fixed as a side effect of this work.
- Google now offers an official, Google-managed remote MCP server for Calendar (`calendarmcp.googleapis.com`, announced at Google Cloud Next '26) using standard OAuth 2.0. Confirms the long-term MCP direction is viable, but is not required for this connector (see Architecture).

## Architecture

A generic `PlatformConnector` contract:

```ts
interface PlatformSignal {
  type: string          // e.g. 'meeting_overload', 'no_focus_window', 'peak_window_conflict'
  headline: string       // human-readable, honest — no clinical/invented language
  detail: string
  severity: 'info' | 'warning'
}

interface PlatformConnector {
  fetchSignals(userId: string): Promise<PlatformSignal[]>
}
```

- **`GoogleCalendarConnector`** (new, thin wrapper): implements `PlatformConnector` by calling the *existing* `calendarService.listEvents()` + `computeCalendarSignal()`, converting the result into `PlatformSignal[]` using the thresholds below.
- Future platforms (Notion, Slack, etc.) implement the same interface. When one of them needs a public MCP server instead of a direct API, a generic `lib/mcp-client.ts` gets built *then* — not now, not speculatively. Nothing downstream (aggregator, Ahora hero, toast, chat context) needs to know which mechanism a given connector uses.
- This is a deliberate two-track decision: fix the real, live Calendar bug immediately using proven direct-API code, while shaping the interface so the *next* platform slots in without an architecture change.

## Data flow

1. `getGoogleEvents()` in `lib/calendar-aggregator.ts` stops returning `[]` — it calls `GoogleCalendarConnector`-backed event fetching, so `/calendar` shows real Google events for the first time.
2. `computeCalendarSignal()` (existing, unchanged) computes meeting count/minutes/largest free gap.
3. A new lightweight check (`lib/cognitive/calendar-signals.ts`) evaluates the thresholds below against that computed signal.
4. If a threshold is crossed **and** no `TwinEvolutionLog` row of the same `changeType` exists for today already, a new row is written — reusing the exact mechanism that already powers the Bitácora (`/api/cognitive/decisions`) and the Twin Insight Toast built this session. No new notification system.
5. `buildUserContext()` (`lib/ai/context-builder.ts`) includes a one-line summary of today's calendar signal, so chat answers like "¿qué tengo hoy?" reflect real data.
6. The "Ahora →" hero (`components/dashboard/now-hero.tsx`) checks the calendar signal alongside pending tasks; a real conflict or notably large free block can outrank a pending task as "the" decision for right now.

**Trigger point:** no new cron/schedule needed. `CognitiveEngineWidget` already fetches `/api/ai/cognitive-engine` on every Today/Cognitive page visit — the signal check and `TwinEvolutionLog` write happen inline there, same request.

## Signal thresholds (v1)

| Condition | Threshold | Example copy |
|---|---|---|
| Meeting overload | A run of 3+ consecutive events today where every gap between one event's end and the next event's start is <10 min | "3 reuniones seguidas sin respiro hoy — considera un buffer de 10 min." |
| No real focus window | `largestFreeGapMinutes` (within waking hours, already computed by `computeCalendarSignal`) is <30 min | "Hoy tu hueco más grande es de 25 min — no hay espacio real para trabajo profundo." |
| Peak-window conflict | Any event's [start, end) interval overlaps the user's declared peak focus window (`energyCurve.peakFocusStart/End`) | "Una reunión cae dentro de tu ventana pico (07:00–10:00) — vale la pena revisarla." |

**Anti-spam rule:** one `TwinEvolutionLog` entry per `changeType` per calendar day, maximum. Never re-announce the same condition on every page load.

**Copy standard:** name the real thing ("3 reuniones seguidas"), never a clinical-sounding label ("Conflicto Detectado") — matches the honesty fix already shipped this session for the cold-start insights.

## Explicitly out of scope for this spec

- Autonomous *write* actions on Calendar (create/reschedule/delete events) — a separate, later spec, deliberately deferred given the higher risk of mutating a user's real external calendar.
- Building the generic MCP client (`lib/mcp-client.ts`) itself — deferred until a platform that actually requires it (Calendar doesn't).
- Any other platform connector (Notion via MCP, Gmail, Slack, etc.).
- The Twin-as-MCP-tool-for-Novo's-own-chatbot project, and the premium chat-input toggle — separate spec.
- The landing page redesign — separate project.
- Any new Settings toggle to disable this — it reads data under a scope the user already consented to at sign-in; no new consent surface added in this pass.

## Testing / verification

- Confirm `/calendar` page shows real Google events for an account with a connected Google calendar (manual check against a real calendar with known events).
- Confirm each of the 3 thresholds fires with synthetic calendar data (a day with 3 tight-packed meetings; a day with one big meeting eating most of waking hours; a meeting placed inside a known peak window).
- Confirm the anti-spam rule: trigger the same condition twice in one day, confirm only one `TwinEvolutionLog` row exists.
- Confirm chat correctly answers "¿qué tengo hoy?" with real event data after this ships.
- Confirm the Ahora hero surfaces a calendar-derived decision when it's genuinely more urgent than the top pending task, and falls back to task-based logic otherwise.
