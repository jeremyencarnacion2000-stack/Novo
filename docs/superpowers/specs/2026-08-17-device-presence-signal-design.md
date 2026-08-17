# Device Presence Signal — Design Spec

## Context

The user asked how Novo learns from the outside world, then asked for Novo to
also connect to **the user's own device** to keep learning/acquiring context.
Novo already has a proven pattern for this: a `PlatformConnector`/
`PlatformSignal` interface (`lib/platform-connectors/types.ts`), per-platform
threshold evaluators (`lib/cognitive/{notion,todoist,calendar,gmail,books}-signal.ts`),
a single shared persistence path (`lib/cognitive/platform-signals.ts`'s
`persistNewPlatformSignals()`), and a shared priority reader
(`lib/cognitive/active-signal.ts`'s `getActiveSignal()`) that all existing
platforms already funnel through.

What doesn't exist yet is a source where **the device/browser itself** is the
platform, instead of a third-party API. Two things the user's own device
could plausibly mean were considered:

1. **Real OS-level telemetry** (installed-app usage, phone screen time,
   notifications, location) via a native Capacitor build. `@capacitor/core`,
   `@capacitor/android`, `@capacitor/ios` are already dependencies, but no
   native build has ever been compiled or shipped — this would need Android's
   user-granted `PACKAGE_USAGE_STATS` permission and iOS's
   `DeviceActivity`/`FamilyControls` entitlement (Apple-approved case by
   case), plus a real device to test on. Not achievable same-day; see
   **Deferred scope** below.
2. **Real activity inside Novo itself** (active/idle state, session length,
   time-of-day usage) via standard browser APIs. No new OS permission, no
   native build, ships today. **This is what this spec covers.**

Today is the XPRIZE submission deadline, so this spec is scoped to (2) only.

## Goal

1. Capture real (not simulated) presence sessions — when the user is
   actively looking at Novo, not just has a tab open in the background.
2. Feed those sessions into the same signal pipeline every other platform
   uses, so the Twin can reason about usage patterns (starting with one
   concrete rule: long unbroken sessions) the same way it reasons about
   overdue Notion tasks or calendar density.
3. Do this without adding a new permission prompt or a new privacy surface
   the user has to explicitly opt into — this is first-party telemetry about
   the use of Novo itself, consistent with what `PRODUCT.md` already permits
   without friction.

## Data Model

New additive Prisma migration:

```prisma
model DeviceActivityEvent {
  id        String   @id @default(cuid())
  userId    String
  startedAt DateTime
  endedAt   DateTime
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, startedAt])
}
```

One row = one continuous presence session (tab visible AND window focused).
Rows are written once, when a session ends — no per-heartbeat rows, so this
table stays small regardless of how long a session runs.

## Capture Endpoint

**New file: `app/api/device/presence/route.ts`** — `POST`, authenticated via
the existing NextAuth session (same ownership pattern as every other
authenticated route: the session's `userId` is used directly, never a
client-supplied one). Body: `{ startedAt: string, endedAt: string }` (ISO
timestamps), validated with Zod (`endedAt > startedAt`, both parseable
dates, `endedAt` not in the future beyond a small clock-skew tolerance).
Inserts one `DeviceActivityEvent` row. No response body needed beyond a 204 —
the client doesn't do anything with the result.

## Client Capture

**New file: `hooks/use-device-presence.ts`** — mounted once in
`components/dashboard-shell.tsx` (the authenticated shell that already wraps
every logged-in page; the public landing page does not mount this).

Mechanics:
- Session starts on mount if the tab is currently visible and focused, or on
  the next `visibilitychange`/`focus` transition into that state.
- Listens for `document.visibilitychange` and `window.blur`. On losing
  visibility/focus, starts a short grace timer (2 minutes) before treating
  the session as ended — a brief alt-tab shouldn't fragment one real session
  into several.
- On session end (grace timer fires, or `beforeunload`/`pagehide` fires),
  sends `{ startedAt, endedAt }` via `navigator.sendBeacon('/api/device/presence', ...)`
  — beacon delivery survives tab close, unlike a normal `fetch`, which is why
  this isn't a plain POST.
- A session under 30 seconds is discarded client-side (not sent) — avoids
  filling the table with noise from someone bouncing through a tab.

## Signal Evaluation

**New file: `lib/cognitive/device-signal.ts`** (mirrors
`lib/cognitive/todoist-signal.ts`'s shape — a pure function over plain data,
unit-testable without a database):

```
evaluateDevicePresence(sessions: DeviceActivitySample[]): PlatformSignal[]
```

First rule only (matching the scope decision made during design review).
Note this is retrospective, like every other platform signal in the app
(Notion/Todoist/Calendar signals are also computed from already-persisted
state on the next `cognitive-engine` evaluation, not pushed live) — a
`DeviceActivityEvent` row only exists once its session has ended, so this
rule looks at the most recently **completed** session, not a still-open one:
- **Long unbroken session**: the most recent completed session exceeds 2
  hours → emits `{ type: 'device_long_session', severity: 'info', headline:
  'Tuviste una sesión de más de 2 horas seguidas en Novo', ... }`. Framed as
  a past-tense habit observation (consistent with the Twin's
  energy/habits-modeling thesis in `PRODUCT.md`), not a live break reminder —
  a real-time in-session nudge would need a heartbeat/upsert mechanism, which
  is explicitly out of scope for this pass.

`app/api/ai/cognitive-engine/route.ts` gets a new block that reads recent
`DeviceActivityEvent` rows for the user, calls `evaluateDevicePresence()`,
and passes the result through the existing `persistNewPlatformSignals()` —
parallel to and independent of every other platform's block, same as Notion
and Calendar already are.

## Active Signal Priority

`lib/cognitive/active-signal.ts`'s `PLATFORM_PREFIX_PRIORITY` gets one new
entry, appended **last** (lowest priority — this is an awareness signal, not
an actionable one like an overdue task):

```ts
{ prefix: 'device_', platform: 'device' },
```

`ActiveSignal['platform']` union type extended with `'device'`.

## Error Handling

- If `navigator.sendBeacon` is unsupported (very old browsers) or returns
  `false` (queue full), the hook drops the session silently — this is a
  best-effort awareness signal, not a critical write, and must never surface
  an error to the user or block navigation.
- The endpoint validates ownership and payload shape but has no other
  failure modes worth special-casing — a malformed body is a plain 400.

## Testing

- Jest unit tests for `evaluateDevicePresence()`, mirroring
  `lib/cognitive/__tests__/todoist-signal.test.ts`: no signal under 2h,
  signal at/above 2h, only the most recent session considered (an old long
  session from days ago must not fire today).
- Jest test for the new `active-signal.ts` priority entry: `device_` signal
  present alongside e.g. a `notion_` signal → Notion still wins (lowest
  priority confirmed).
- Route test for `app/api/device/presence/route.ts`: rejects unauthenticated
  requests, rejects `endedAt <= startedAt`, persists a valid row scoped to
  the session's own `userId`.
- Manual verification after deploy: use Novo for 2+ minutes, background the
  tab, confirm a `DeviceActivityEvent` row appears; seed a completed test row
  with a 2h+ span (a real 2-hour wait isn't practical for same-day
  verification) and confirm the signal surfaces in the "Ahora" hero card on
  the next page load/evaluation.

## Rollout

Same pattern as prior signal work: typecheck → focused Jest run → build →
`vercel deploy --prod` → `vercel alias set <deployment> productivitynovo.vercel.app`
(the alias does **not** auto-follow deploys — confirmed the hard way earlier
today) → curl verification of `/`, `/landing`, `/api/auth/session`. No
feature flag; this is additive and safe to ship directly, same as every
other signal source in the app.

---

## Deferred scope: native OS device connector (NOT part of this implementation)

Documented for a future session, not planned into an implementation plan
today:

- **Target data**: installed/foreground app usage, phone screen time,
  system notifications, coarse location — the things people actually mean by
  "connect to my device," beyond in-app activity.
- **Platform requirement**: an actual compiled and installed native build via
  the existing Capacitor scaffolding (`@capacitor/android`, `@capacitor/ios`),
  which has never been built or shipped for this project. This is new
  infrastructure, not an extension of anything running today.
- **Android path**: `PACKAGE_USAGE_STATS` — cannot be granted via a normal
  runtime permission dialog; the user must be deep-linked to the system
  Settings screen for the app and grant it manually. A Capacitor plugin
  (existing community plugin or a small custom one) reads `UsageStatsManager`.
- **iOS path**: Screen Time data requires the `DeviceActivity`/
  `FamilyControls` framework, gated behind an Apple-granted entitlement —
  requested from Apple, not self-service, and can be rejected or take days.
  Location/notifications are more standard but still need their own native
  permission flows.
- **Why this can't be today's scope**: no existing native build to extend,
  a manual OS-settings permission grant that can't be demoed without a real
  device, and (for iOS Screen Time specifically) an external approval
  dependency outside Novo's control.
- **Integration point once built**: same shared pipeline as everything else
  in this spec — a new `PlatformConnector`/signal-evaluator pair, feeding the
  same `persistNewPlatformSignals()` and `active-signal.ts` priority list.
  The web presence work in this spec is not throwaway — the native connector
  would reuse the same `DeviceActivityEvent`-style pattern and the same
  downstream evaluation/surfacing code, only the capture layer differs.
