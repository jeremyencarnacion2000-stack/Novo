# Hub, Pomodoro and mobile motion recovery

## Cause

The approved September/October Hub and mobile motion changes remained in the
`4865` worktree and were absent from the October 12 production release. The
recovery integrates the relevant components into the current `main` checkout
while retaining current Companion navigation and chat/input behavior.

## Motion contract

- Hub opening uses the Companion's `Tracked` spring: response 0.5 seconds,
  damping 0.72, independent width/height/radius channels and 240 Hz substeps.
- Hub closing uses its 340 ms cubic curve `(0.45, 0, 0.2, 1)`.
- Interruption resumes from the visible dimensions. The optical body resizes
  directly; text and refraction are not scaled with it.
- Pomodoro detaches from the focus control into a separate compact surface.
  Closing returns to the Hub without stopping the timer. Pause/reset do not
  dismiss the widget.
- The mobile rail and plus remain separate at rest. A single liquid controller
  owns their transition into the bottom panel and the return flight. Other
  dialogs retain their existing motion controller.
- Reduced/off motion settles directly without the physical spring.
- The service worker cache advances to `novo-v11`.

## Evidence and limits

- Restored regression tests initially exposed 13 failures in the old checkout.
- The full Jest suite passed: 267 suites, 1,004 tests and 2 snapshots.
- Targeted recovery checks passed again after the reduced-motion adjustment.
- A repeat full run under concurrent local load had one mobile menu test time
  out at its 5-second limit; the same suite passed in isolation. The final run
  allowed 15 seconds per test without changing assertions and passed all 267
  suites / 1,004 tests / 2 snapshots in 99.1 seconds. Targeted ESLint passed.
- The Vercel preview compiled and completed TypeScript checking.
- Browser checks used actual components with local demo providers: desktop
  Hub opening/closing and interruption; Pomodoro detach/return, pause/reset and
  continued timing; mobile rail/panel return and reversal; no horizontal
  overflow or console errors in those scenarios. The Hub body scrolls to make
  its lower controls reachable.
- Authenticated production account flows were not exercised by the local
  fixture. This change has no database migration or native installer update.

The web spring helper retains attribution to the Companion/Coucou implementation
and its MIT license in `companion/windows/THIRD-PARTY-LICENSE.txt`.
