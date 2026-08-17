# Novo UI regression audit

**Date:** 2026-08-15  
**Scope:** Phase 1 of the Cognitive Experience milestone  
**Baseline for selective comparison:** `49415f2`  
**Method:** source and history comparison, existing visual evidence, focused
component tests, and public deployment smoke evidence. This is an audit, not a
claim that authenticated device flows have already passed.

## Evidence considered

- Current shell and navigation: `app/client-layout.tsx`,
  `components/mobile-nav.tsx`, `components/mobile-section-drawer.tsx`, and
  `components/app-sidebar.tsx`.
- Current chat surface: `components/ai/modern-chatbot/` and its composer.
- Current cognitive surface: `components/cognitive/cognitive-command-surface.tsx`
  and `components/cognitive/twin-brain-map.tsx`.
- Material controls and consumers: `lib/material-contract.ts`,
  `lib/settings-context.tsx`, `components/ui/card.tsx`,
  `components/ui/GlassSurface.tsx`, and `app/globals.css`.
- History: `49415f2`, `cc9c606`, `946fa97`, `8468212`, `4dad63e`, `417e57d`,
  `e0afe09`, `6f5e8fe`, `ba58cc4`, and `d0fe9f0`.
- Earlier rendered evidence in
  `docs/audit-evidence/visual-restoration-final/` and
  `docs/audit-evidence/visual-restoration/VISUAL-RESTORATION-MANIFEST.md`.
  It is historical evidence, not a substitute for a fresh authenticated run.
- Focused test run on 2026-08-15: **9 suites / 39 tests passed** covering mobile
  navigation, chat input, material contract/theme updates, sidebar/card
  material, the restored tier hierarchy, Cognitive command surface, and graph
  visual continuity.

## Executive result

The repository has the right *structural* direction for the product: a single
core mobile navigation, a secondary workspace layer, a canonical Chat route,
and a shared Cognitive surface. The highest-confidence regression was visual:
the material system had collapsed several semantic card tiers onto the same
Focus surface. The first selective recovery restores that separation; rendered
validation is still required to confirm the reported hard outlines and weak
hierarchy are gone.

The tests prove that settings update the material contract and its CSS
variables. They do **not** prove the final rendered contrast, blur, keyboard or
gesture behavior on a real authenticated device. Those remain Phase 2 gates.

## Findings and recovery contract

| Surface | Evidence | User impact | Recovery contract | Status |
| --- | --- | --- | --- | --- |
| Shared card hierarchy | The prior working tree mapped `card--hero`, `card--primary`, `card--secondary`, `card--tertiary`, `glass-surface`, `glass-floating` and `glass-active` to the same `--novo-focus-*` contract. Baseline `49415f2` maintained distinguishable subtle/elevated/premium tiers. The first selective recovery restores Context to secondary, tertiary and repeated card tiers while retaining Focus for hero, primary and elevated surfaces; the regression test now protects that division. | Everyday cards, elevated panels, active controls and dialogs no longer need to share the same border/shadow strength. | Keep the restored role hierarchy: context for ordinary/repeated cards and focus for active/decision surfaces. Do not redesign or add effects. | **Code recovery complete; rendered certification required** |
| Settings-to-material wiring | `SettingsProvider` reapplies `--novo-context-*`, `--novo-focus-*`, `--card-blur-px`, and `--glass-blur-px` after changes and theme flips; focused tests pass. The restored hierarchy now lets different semantic card roles consume their intended material, but browser composition still needs verification. | A user can change a setting yet see broad regions change together, so the controls appear ineffective. | Keep the existing contract and settings keys. Certify independent card/sidebar changes with a wallpaper on desktop and mobile. | **Partially proven; visual certification required** |
| Dark visual neutrality | `lib/material-contract.ts` now uses neutral white-alpha dark materials and tests reject the previous blue-black fill. Historical visual reports still show fixed blue/outline residues. | Dark mode can feel colder, more outlined and less coherent than the accepted baseline. | Audit hard-coded blue/foreground classes only where they visibly override the neutral contract; restore neutral tokens selectively. | **User-reported; source audit required during Phase 2** |
| Desktop core navigation | The current shell/sidebar retains the requested primary destinations and desktop secondary access. Existing evidence also shows prior sidebar clipping/contrast instability. | A user must never lose Today, Cognitive, Chat or Activity; secondary workspace cannot become a hidden maze. | Verify one-click primary access plus Projects, Calendar, Checklist, Integrations and Settings from desktop. Fix only a reproduced reachability or overflow defect. | **Structure present; flow not freshly certified** |
| Mobile core navigation | `components/mobile-nav.tsx` exposes Today, Cognitive, Chat and Activity as four 44 px targets. Labels deliberately appear only from 390 px; More opens a separate workspace drawer. The focused navigation test passes. | This avoids a crowded 320 px bar, but must be validated for safe-area, overlay and route transitions. | Preserve the four destinations and the separate workspace layer. Do not add more primary icons. | **Structure and component contract pass; device QA pending** |
| Mobile workspace / overlay | `components/mobile-section-drawer.tsx` contains Projects, Checklist, Calendar and Connectors plus Settings, Profile, Voice and Search; it uses the shared overlay state and drag-to-dismiss hook. | Modal ownership, touch dismissal and return to the nav bar can still fail only on a device. | Verify open, close, drag-down, backdrop, route selection, screen-reader modal state and safe areas. No global overlay rewrite. | **Component contract present; device QA pending** |
| Chat route and composer | `/chat` is the canonical primary target. The current composer includes a portal sheet, safe-area padding and progressive tool controls; focused tests pass. Historical commits show this area has regressed before. | Keyboard, tools sheet, history, attachment and scrolling failures would make the primary conversational Twin surface unreliable. | Audit at 320, 360, 390, 412 and 430 px: history selection, scroll ownership, keyboard, tools, new chat, mic, attachment, streaming/error/reconnect and return navigation. Restore only reproduced behavior. | **High priority; no current real-device proof** |
| Cognitive graph continuity | `TwinBrainMap` includes a persistent SVG silhouette behind the interactive graph and the focused continuity/command tests pass. Existing captures show one short-lived graph state that differs from the settled one. | A flash between two visual graph models undermines the Twin's intelligibility. | Measure the actual authenticated loading-to-settled path. Keep the structured graph model if it is the intended projection; remove only a confirmed fallback/transition mismatch. | **Component proof pass; visual runtime QA pending** |
| Language and information consistency | Captures include mixed Spanish/English labels and some low-contrast historical surfaces. | The product can feel less intentional and users may misread navigation. | Include language, truncation, empty/error/loading and contrast checks in every required flow; fix only visible inconsistencies. | **QA gate** |

## Required Phase 2 test matrix

The following flows must be captured before any milestone can claim functional
recovery:

1. **Today -> Cognitive -> Chat -> Activity -> Today**, desktop and mobile.
2. **Today -> Projects -> Calendar -> Checklist -> Today**, desktop and mobile.
3. **Mobile More -> Settings -> back to the same workspace context**.
4. **Chat conversation selection -> send -> tool sheet -> keyboard -> return**.
5. **Cognitive overview -> focused node -> Why/evidence -> inspector ->
   correction/exclusion -> recenter**.

Required widths: **320, 360, 390, 412 and 430 px**, plus a tablet width and
one desktop width. Capture normal, loading, empty, error and returned states
where the flow exposes them. A screenshot alone is insufficient for keyboard,
scroll and drag behavior; those need interaction evidence.

## Phase 2 order and safety boundary

1. Certify the restored material hierarchy on a controlled wallpaper at desktop
   and mobile widths, including independent card/sidebar sliders.
2. Certify desktop and mobile navigation using the five flows. Repair only a
   reproduced reachability, overlay or safe-area defect.
3. Certify mobile Chat deeply before touching its design.
4. Certify the Cognitive graph's loading-to-settled continuity before changing
   its projection or styling.
5. Run focused tests, lint/type checks relevant to changed code, and capture
   before/after evidence.

## Explicit non-actions while the recovery gate is open

- No global rollback and no broad CSS reset.
- No new landing, graph, animation, particle, glow, parallax or metric work.
- No duplicate memory, graph, activity, recommendation, agent or chat system.
- No creative visual redesign: recovery is against the established product
  roles and verified user flows.
- No release claim until the functional matrix above is evidenced.

## Phase 1 conclusion

**PASS; Phase 2 is in progress.** The thesis and failure boundary are now
documented, and the first confirmed material regression has been restored with
a focused regression test. Real responsive certification remains the next
release gate; product expansion remains stopped.
