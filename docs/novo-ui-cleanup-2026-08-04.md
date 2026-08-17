# Novo UI cleanup + Cognitive redesign pass

## Direction

This pass keeps the existing product truth and removes competing visual stories. The landing now sells one idea — a living Twin that returns direction — while Cognitive has one operational map instead of a dashboard plus a second decorative graph.

## Before → after

| Surface | Before | After |
| --- | --- | --- |
| Landing product proof | Generic `product-ai.png` browser mockup | `TwinPresenceArtwork`: abstract active presence with a single state, message and action affordance |
| Landing atmosphere | Static dark field with local glows | `landing-ambient`: two-direction green/teal field, fine grain and 26s low-noise drift; disabled for reduced motion |
| Cognitive route | Twin hero, confidence/focus rings, burnout gauge, energy timeline, metric strip, old force graph, decision feed, module/system strips | One calm header plus `CognitiveCommandSurface`: recommended action, facts/inference, one contextual graph, inspector, correction and learned changes |
| Graph system | `CognitiveGraphView` force simulation with separate visual language | Single bounded snapshot graph in `CognitiveCommandSurface`; old component removed |
| Global notification control | Heavy 40px floating bell with aggressive right offset | Restrained 36px control with safer mobile inset and preserved expanded Sileo state |

## Why this improves the Twin perception

- The first layer now answers what Novo understands and what to do next, instead of asking the user to decode scores.
- Facts, inference, relationships and learned changes remain inspectable without making confidence a pseudo-scientific hero metric.
- The graph is a contextual instrument: lens, search, selection, inspector and exclusion all operate on persisted evidence.
- The ambient field gives the landing a living identity without particles, neon or a looping UI loader.

## Validation

- Strict TypeScript: PASS.
- Focused Jest: `cognitive-command-surface` and `globals` — 7/7 tests PASS.
- Targeted ESLint for changed TS/TSX files: PASS; the detector reports only two pre-existing bounce-easing warnings in unrelated global CSS lines.
- Reduced motion is covered by the landing ambient media query and existing app viewport motion rules.

## Preview evidence

- Preview `https://novo-desktop-jyvm70nzq.vercel.app` completed the Vercel build with 128/128 pages and Ready status.
- Public landing canary returned HTTP 200 and exposed the new “Presencia del Twin” artwork in server-rendered text.
- Responsive screenshots: `docs/novo-ui-pass-mobile.png`, `docs/novo-ui-pass-tablet.png`, `docs/novo-ui-pass-desktop.png`.
- Production promotion completed as `novo-desktop-gzocryzph.vercel.app`; the explicit alias `productivitynovo.vercel.app` was assigned afterward. Final HTTP canary: 200, 50,029 bytes, new Twin presence copy and canonical metadata present.

## Remaining evidence

The new UI needs a fresh Preview deployment and authenticated browser screenshots before production promotion. The existing production deployment still contains the previous pass until that gate is run.

## Final chat cleanup and production promotion � 2026-08-04

- Removed the redundant mobile chatbot header controls: Home, brain mark, `Novo AI` label and the global notification bell. Desktop retains only controls that remain useful at that breakpoint.
- The Tools sheet now renders through `createPortal(..., document.body)`, uses an opaque blurred backdrop, blocks body scrolling while open, closes on outside click or Escape, and restores focus to its trigger.
- Fresh preview created from the local working tree: `https://novo-desktop-mld9cd6mk.vercel.app` (`dpl_Fu1i18bGadxAm7gVmi2jAGkuP9Ca`).
- Production promotion created: `https://novo-desktop-glzkf745r.vercel.app` (`dpl_P6EiRJ7QTFauBy32a1kAg9LCFPVk`), then assigned to `https://productivitynovo.vercel.app`.
- HTTP smoke checks returned 200 for `/landing`, `/today`, `/cognitive`, `/chat`, `/auth/signin` and `/auth/signup` on the fresh preview and production alias. Landing retained the Twin presence marker and canonical metadata.
- ESLint passed for the modified chatbot/layout files; `git diff --check` completed without content errors. Full TypeScript remains expensive locally and should be confirmed by the remote production build (which reached Ready).

## Mobile navigation correction � 2026-08-04

- Canonical home is `/today`.
- Global mobile navigation now exposes four labelled destinations: Hoy (`/today`), Cognitivo (`/cognitive`), Chat (`/chat`) and Actividad (`/activity`). Hoy uses a house icon and is available from deep links.
- Chat remains free of the redundant internal header. The conversation drawer is now a full-viewport surface with a full backdrop so background widgets and navigation cannot remain interactive above it.
- A fresh preview attempt was created from the local state (`novo-desktop-dr35gufq4.vercel.app`, then `novo-desktop-8dyrz83m4.vercel.app`) but both ended in Vercel build error before READY; production alias was intentionally left on the last verified production deployment. No production promotion was performed for this pass.
- Modified files: `components/mobile-nav.tsx`, `components/ai/modern-chatbot/index.tsx`, `components/ai/modern-chatbot/sidebar.tsx`, `components/ai/modern-chatbot/chat-input.tsx`, `app/client-layout.tsx`.
- ESLint passed for modified files; local TypeScript/build processes exceeded the local execution window without emitting a compiler error. Remote preview build remains the blocking gate.

## Navigation gate resolved � 2026-08-04

- Root cause of failed previews: `pathname` from `usePathname()` was nullable in `components/mobile-nav.tsx` (TS18047). Normalized it through `currentPath = pathname ?? ''`.
- New preview: `https://novo-desktop-b2dl9ws0y.vercel.app`, deployment `dpl_CKYuJMd7oFLKrcTvTfcuSqGP8wj6`, Ready.
- Exact preview promoted to production as `https://novo-desktop-dhjikl5v0.vercel.app`, deployment `dpl_CWAnBSfHzeisk7ECrV9AeLmjW2Kq`, Ready.
- Alias confirmed: `https://productivitynovo.vercel.app`.
- Production smoke checks returned HTTP 200 for `/today`, `/chat`, `/cognitive`, `/activity`, `/landing` and `/auth/signin`.
