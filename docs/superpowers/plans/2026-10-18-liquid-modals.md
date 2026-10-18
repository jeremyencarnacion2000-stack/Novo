# Liquid modal implementation plan

> Execute inline in this chat, as previously selected by the user.

**Goal:** Every web modal opens as a liquid drop from its real source and returns through the same path, preserving readable content, focus and approval semantics.

**Architecture:** One spring drives decorative chrome and shared elements while Radix owns interaction and final layout. Dialog, Sheet and AlertDialog capture origins before autofocus; mobile navigation retains its existing liquid geometry owner. No new dependency or local full build (C: has little free space).

## Tasks

- [x] Add tested pure droplet geometry and an interruptible runtime using the existing Spring and neck profile. Bound the SVG to the source/target union; keep live text outside filters. Test triple reversals, immediate close, missing source, reduced/off modes and cleanup.
- [x] Connect all three modal primitives and legacy shared IDs to the runtime. Capture actual activation origins, accept explicit anchors, retain last open content through exit, compose refs, and hand sheet dismissal to the return animation.
- [x] Migrate two custom overlays, native confirmations and conditional consumers that cut off exits. Preserve every mutation's explicit confirmation and existing idempotency.
- [x] Audit all 41 modal/sheet call sites and 11 browser confirmations. Run relevant tests and lint, then inspect desktop/mobile, interruption, nesting and reduced/off states with /browse.
- [ ] Obtain one fresh functional review, fix blockers, publish to GitHub/Vercel, and verify the exact production deployment.

## Decisions and progress

- Source-less programmatic dialogs bloom locally at their own center; no unrelated trigger is invented.
- Presentation (center/sheet/fullscreen) is independent of origin. Text stays at its final dimensions; only decorative material changes shape.
- All destructive confirmations remain opt-in; cancellation/unmount resolves false.
- Initial audit: standard primitives cover 41 call sites; two custom overlays and 11 native confirms need migration. Existing shared close reversal callbacks and sheet gesture ownership need correction.

- Review: corrected async callback, nested positioner stacking, early portal gesture binding, scoped gesture overlay and immediate motion-off workout cancellation. The latter was reproduced by a failing test and then passed after using a synchronous reason ref.
