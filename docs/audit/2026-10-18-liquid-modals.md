# Liquid modal coverage — 18 October 2026

## Shared behavior

Dialog, Sheet and AlertDialog now use a single liquid controller. An actual trigger is captured before autofocus, with a saved rectangle if the trigger later disappears. Explicit shared IDs and contextual anchors remain supported. Programmatic openings without a real source bloom at their own center.

The existing Companion spring drives one progress value through source → drop → surface. Opening and closing retarget that same spring without discarding its live velocity. A bounded decorative SVG draws the source, neck and drop; DOM material layers follow the geometry. The real Radix form stays at its final dimensions, outside filters. Matched shared glyphs crossfade at their real sizes without stretched typography.

Close intent is reported immediately so controlled consumers can reopen mid-return. Last-open children and configuration remain present until the return completes. `onExitComplete` is available for actions or consumers that must wait before unmounting. Latest callbacks are read from refs. Radix continues to own focus trapping, escape, scroll locking and modal semantics; focus returns to the captured interactive origin.

Reduced mode uses a short fade; off mode settles immediately. Live changes cancel decorative work. Viewport changes settle a running transition instead of leaving stale geometry. Cleanup restores original styles and removes chrome, shared clones, frames, observers and ownership records. Nested surfaces elevate their positioner and overlay together. Sheet gestures bind after portal commit, retain native reading scroll, use their own overlay and hand their presented position directly to the liquid return.

## Inventory

Audited 41 Dialog/Sheet call sites, two custom modal windows and eleven native confirmations. No intercepted/parallel modal routes were found.

| Area | Covered surfaces |
| --- | --- |
| Projects and tasks | ProjectDialog, TaskDialog, ChecklistTaskDetail, dashboard quick view |
| Routines and focus | RoutineDialog, RoutineDetailDialog, ImportRoutineDialog, active workout, FocusSettings |
| School, library and trackers | CourseDialog, GradeDialog, BookDetailsDialog, TrackerDialog |
| Business and calendar | Client/content/deal forms, event creation/details, calendar sidebar |
| Chat | History, tools, connectors, mobile chat, document previews, action review, voice overlay |
| Global and settings | Settings, command palette, capture, voice hub, notifications, contextual wrappers |
| Other | Developer context preview, custom connectors/details, cognitive commands/sharing, paywall, player |

The mobile navigation panel retains CommandCenterLiquidMorph as its sole geometry owner. It already uses the liquid neck profile; launching another driver would duplicate that transition.

## Gaps repaired

- Converted developer preview and voice overlay to real Dialog primitives.
- Kept document viewers and lazy global capture mounted during close.
- Delayed workout completion/cancel parent callbacks and chat action execution until return completes.
- Retained school selection, book/routine data and player track data for exits.
- Preserved player portal through suppression/eligibility changes and project dialog trees through live capacity-mode changes.
- Removed the tracker's duplicate external close animation.
- Replaced all eleven browser confirmations with queued async AlertDialogs. Approval resolves only after explicit choice and completed exit; cancellation, navigation and provider unmount deny the intent. No mutation runs on display alone.

## Validation

Geometry/lifecycle tests cover exact endpoints, bounded effects, missing origins, triple reversal, immediate close, dynamic motion-off changes, cleanup, scoped overlays and confirmation ordering. Presence tests retain selected content and report close intent without tearing down the surface. Source inventory tests prevent native confirmations and custom modal windows from bypassing the shared primitives.

Browser inspection uses actual primitives with synthetic content at 1440×900 and 320×740. It covers mid-flight geometry, retained drafts, reopen, nested cancellation/focus, shared typography, bounded mobile layout, scrollable content, touch-dismiss handoff and reduced/off modes. This fixture does not authenticate a real account or execute personal mutations. Full Next build/TypeScript validation runs in Vercel because the local C: volume has insufficient room for a safe full build.
