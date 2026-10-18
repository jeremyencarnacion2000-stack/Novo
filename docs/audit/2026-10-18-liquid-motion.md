# Liquid motion across Novo web

## Reference and adaptation

Study: https://github.com/rit3zh/expo-dynamic-notifications at `5de059a`.
Read the geometry builder, spring configuration, phase timeline, goo renderer,
content reveal, swipe recognizer, layout builder and MIT license.

Novo ports the drop growth power (1.25), 0.7 growth span, 0.38 stretch,
normalized neck profile (1.6 / 1.4), 0.82 neck break, 34px gap, 52px drop,
14.3px blur and alpha matrix (gain 22 / threshold 0.43). Expansion starts at
340ms, reveal at 560ms; return hides content before collapsing and retracting.
Motion's duration/bounce springs adapt the native duration/damping-ratio springs.
The source library requires React Native, Skia and Reanimated; the web port
uses the installed Motion renderer and SVG. Attribution is retained in
`THIRD-PARTY-NOTICES.md`.

## Delivered behavior

- Bell and Hub notices share a retained, reversible drop/neck/card presentation.
  The Hub's horizontal flight uses the same geometry, rotated toward its origin.
  Narrow screens use a bounded downward flight. Long text remains readable and
  scrollable. The goo filter affects only decorative shapes, never DOM text.
- A replacement waits while the previous notice returns. Bell readable dwell
  begins after reveal; stale dismissal cannot close a newer notice.
- Both source controls stay available. Simultaneous notices reserve one
  another's final rectangle where the viewport has room.
- Hub content now animates on each expansion, with retained source refs for the
  Pomodoro. Width, height and radius retarget live springs in both directions;
  safe vertical repositioning also uses a spring. Turning animations off settles
  a flight directly. The existing desktop/mobile motion preference policy stays.
- Pomodoro detach/return and mobile navigation use the reference neck profile
  while retaining their single geometry controller and keyboard/focus lifecycle.
- Popovers, menus, submenus, selects, hover cards and tooltips share anchored
  arrival/return timing, with reduced/off alternatives.

## Validation

Targeted regression checks cover drop geometry, overshoot, narrow viewports,
retained replacements, reversal, following the source, readable lifetime,
Hub keyboard/focus behavior, Pomodoro lifecycle and mobile navigation.
Final run: 10 suites / 61 tests pass, including service-worker API safety.
Targeted ESLint and whitespace checks pass. A fresh independent review reported
no remaining blockers after source movement, touch scrolling and dwell fixes.
Browser review uses actual components with local provider fixtures and synthetic
content; it does not authenticate or access the user's connected accounts.
At 320 x 740, both notices fit at x=16, width=288 without overlap or horizontal
overflow. At 1440 x 900, sampled Hub reversals retain the current width (300px
at close; 77px at reopen) and settle at 360 x 420. The drop shows neck stretch,
separation before expansion, then sharp content reveal. No browser console
errors were recorded. The service worker cache advances to `novo-v12`.

The local full TypeScript check exhausted a 2GB heap. Production compilation and
type checking run in the Vercel preview before integration. A local cache cleanup
was blocked by automatic policy review, so no build cache was removed.
