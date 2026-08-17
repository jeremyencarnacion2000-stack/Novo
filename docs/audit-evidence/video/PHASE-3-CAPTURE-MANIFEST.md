# Novo Phase 3 — Product Capture Manifest

Date: 2026-08-12

## Capture contract

This manifest separates recorded product evidence from a controlled synthetic demo. The QA fixture is `audit-phase1-user-reserved` on the isolated development branch `novo-e2e-test-20260812`. No personal user data is used. The Preview deployment is public and READY, but its authenticated API is not configured, so authenticated product footage comes from the isolated environment only.

| Shot | Status | Classification | Source | Take | Notes |
|---|---|---|---|---:|---|
| 01 — Landing hero / opening brand moment | CAPTURED | CONTROLLED DEMO | `docs/audit-evidence/twin-graph-2/landing-desktop.png` | 1 | Dark Novo landing with sculpture and atmospheric depth. |
| 02 — Today / prioritized Action A | CAPTURED | CONTROLLED DEMO | `docs/audit-evidence/phase1-current-auth/today-desktop.png` | 1 | Synthetic authenticated Today surface; not presented as a live user. |
| 03 — Leaving Novo | NOT_SHOWN | — | — | — | No clean screen-recorded transition captured yet. |
| 04 — External Todoist completion | BLOCKED | NOT_SHOWN | — | — | No dedicated real Todoist account/network proof. Do not imply this happened in footage. |
| 05 — Returned state after completion | CAPTURED | CONTROLLED DEMO | `docs/audit-evidence/video/phase3-cognitive-overview.png` | 1 | Real persisted synthetic Twin state; not a single recorded external-loop replay. |
| 06 — Activity / observed outcome | CAPTURED | CONTROLLED DEMO | `docs/audit-evidence/phase1-current-auth/activity-desktop.png` | 1 | Synthetic durable activity trace. |
| 07 — Cognitive Twin overview | CAPTURED | CONTROLLED DEMO | `docs/audit-evidence/video/phase3-cognitive-overview.png` | 1 | Authenticated isolated Twin rendered from persisted QA data. |
| 08 — Twin Focus state | CAPTURED | CONTROLLED DEMO | `docs/audit-evidence/twin-graph-2/fresh-mobile-2.png` | 1 | Focused cognitive surface from the isolated fixture. |
| 09 — Why / evidence path | CAPTURED | CONTROLLED DEMO | `docs/audit-evidence/twin-graph-2/why-mobile-ready.png` | 1 | Map ready state with evidence path visible. |
| 10 — Inspector | CAPTURED | CONTROLLED DEMO | `docs/audit-evidence/twin-graph-2/inspector-mobile.png` | 1 | Context detail sheet with evidence/inference separation. |
| 11 — Chat: “What should I do now?” | NOT_USED | — | `docs/audit-evidence/phase1-current-auth/chat-desktop.png` | — | Existing chat capture is not certified as reflecting the evolved external state, so it is excluded from the hero story. |
| 12 — Final landing / logo | CAPTURED | CONTROLLED DEMO | `docs/audit-evidence/twin-graph-2/landing-mobile-final.png` | 1 | Clean mobile closing frame. |

## Product truth

- The isolated Twin route, graph, focus, Why, inspector, learning and recenter states are real persisted product behavior against synthetic QA data.
- The Todoist Ambient Runner and durable completion path are implemented and tested, but no real external Todoist network event was recorded for this capture.
- The main video must not cut from an apparent external Todoist action directly to the changed Twin state without labeling that section `CONTROLLED DEMO` or obtaining a real provider proof.
- Correction remains `NOT_CERTIFIED` and is intentionally outside the Phase 3 hero sequence.

## Environment

- Preview: `https://novo-desktop-osasange2.vercel.app` — READY, unauthenticated smoke only.
- Production: `https://productivitynovo.vercel.app` — deployed separately; not used as a QA capture database.
- Recording environment: isolated development server on the protected QA Neon branch.
- Synthetic user: retained for demo/testing; no real user data.

## Gate

Critical product footage: `INCOMPLETE`

Reason: the honest hero sequence still lacks a recorded external completion and a linked automatic Action A → Action B transition. The available Twin and inspectability shots are ready for assembly as a product walkthrough or controlled demo, but they should not be narrated as a real external-loop event.
