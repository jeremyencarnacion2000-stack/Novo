# Novo — Visual restoration manifest

Date: 2026-08-13

## Baselines

- Candidate last-good visual commit: `49415f2` (`feat(ux): drag-to-dismiss on all modals+sheets, notification panel mobile bottom-sheet, premium animations`). It is used as the visual reference only; `HEAD` is not moved.
- Current backend baseline: `f5e8ea7` (`feat(todoist): persist verified provider identity`).
- Historical product evidence: `docs/audit-evidence/phase1-current-auth/home-desktop.png` and the companion Today, Activity, Chat, and Cognitive captures.

## Change classification

| Class | Scope | Decision |
| --- | --- | --- |
| A — backend/domain | Prisma, Task/Outcome/Replan, Todoist, Ambient, OAuth, cognitive graph/projection | Keep unchanged |
| B — infrastructure/performance | route shells, lazy boundaries, providers, durable sync and QA wiring | Keep unchanged |
| C — pure visual | material fallbacks, ambient field strength, card/sidebar readability | Restore to the incumbent Novo light/dark values |
| D — mixed | `DashboardShell`, mobile navigation/drawer, `GlassSurface`, `Card` | Keep current interaction, ownership, and route logic; change presentation only when needed |
| E — landing | `app/landing/**` and landing-specific styles | Untouched |

## Restoration guardrails

- No `git reset`, rollback, or historical tree checkout.
- No landing edits.
- No new product visual language; the pass restores the existing Novo editorial/light glass system.
- Material controls remain reactive. On a flat canvas, card/sidebar opacity and blur now use the user's requested values without hidden floors; wallpaper safety floors remain limited to wallpaper mode.
- Mobile overlay arbitration, drag-to-dismiss, dashboard reachability, and Cognitive startup optimization remain functional changes and are not reverted.

## Restored visual source

| Surface | Restoration | Functional logic preserved |
| --- | --- | --- |
| Dashboard `NowHero` | Reinstated the incumbent primary-tint gradient, radius and optical hairline from `49415f2`; removed the later global focus material | Current recommendation, checklist and Twin-confidence data |
| Shared `Card` | Reinstated the incumbent default/secondary/tertiary/ghost hierarchy; removed forced focus material from every card | Existing variants, events and content |
| Desktop sidebar | Reinstated the historical glass opacity/blur variables and edge treatment | Current routes, hover expansion, user/Twin state and Settings trigger |
| Mobile navigation | Reinstated the historical dock/FAB opacity and blur | Dashboard access, overlay arbitration and voice routing |
| Dialog/Sheet primitives | Removed the later global material override; component-owned backgrounds, elevation and gestures are authoritative again | Drag-to-dismiss, Escape/back behavior and focus management |
| App viewport | Removed the later global ambient/noise pseudo-layers | Wallpaper, theme and appearance transitions |

## Evidence

All captures use the rendered production build, authenticated as the reserved synthetic QA identity against the isolated E2E database.

- `docs/audit-evidence/visual-restoration-final/01-dashboard-desktop.png`
- `docs/audit-evidence/visual-restoration-final/02-dashboard-mobile.png`
- `docs/audit-evidence/visual-restoration-final/03-chat-desktop.png`
- `docs/audit-evidence/visual-restoration-final/04-chat-mobile.png`
- `docs/audit-evidence/visual-restoration-final/05-activity-desktop.png`
- `docs/audit-evidence/visual-restoration-final/06-cognitive-mobile.png`
- `docs/audit-evidence/visual-restoration-final/07-navigation-desktop.png`
- `docs/audit-evidence/visual-restoration-final/08-navigation-mobile.png`
- `docs/audit-evidence/visual-restoration-final/09-settings-modal-desktop.png`
- `docs/audit-evidence/visual-restoration-final/10-cognitive-desktop.png`
