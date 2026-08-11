# Workout navigation decision — Option B

## Decision

Workout (`/routines`) is outside the Phase 1 critical journey. It remains reachable
from the desktop and mobile **More** collections and command search, but is not a
desktop/mobile primary destination or a critical quick action.

The Phase 1 critical-journey boundary is **Dashboard, Today, Cognitive, Chat, and
Activity**. Keeping Workout secondary preserves the routine flow without competing
with those daily navigation destinations.

## Audit method

Audited on 2026-08-11 with:

```powershell
rg -n "(/routines|Workout|Rutina|Start Workout)" app components lib
```

Classifications below cover every matching location. “Secondary” means a
deliberate, non-critical way to reach or use routines; “legacy” means supporting,
historical, analytics, AI, or API behavior rather than navigation.

| Classification | Matching locations | Disposition |
| --- | --- | --- |
| Primary (remediated) | Post-change evidence: commit `3b057ac` removes `New Routine` and `Start Workout` from `components/quick-actions.tsx`; neither action is present in that commit's file. | The direct Workout quick actions were removed before the captured audit. |
| Secondary | `app/templates/page.tsx:35`; `app/routines/page.tsx:6-14,41,76,112,156,222`; `app/cognitive/page.tsx:405`; `components/app-sidebar.tsx:159`; `components/mobile-section-drawer.tsx:51`; `components/command-palette.tsx:74`; `components/routines/routine-stats.tsx:117`; `components/routines/routine-detail-view.tsx:14,17,48,112,114`; `components/routines/routine-detail-dialog.tsx:6,22,31,32,35,37,42,43,48-52,76`; `components/routines/import-routine-dialog.tsx:108,286`; `components/routines/active-workout-session.tsx:20,26,41,174,184,191,193,249`; `components/dashboard/dashboard-quick-view.tsx:8-9,25,31-36,50`; `components/routines/__tests__/routine-mobile-layout.test.tsx:12`; `lib/translations.ts:52,76`; `lib/i18n.ts:171,226` | `/routines` is available from More, command search, and a Cognitive recommendation; routine screens and their localized labels continue to work unchanged. |
| Legacy | `app/api/mcp/route.ts:163`; `app/api/routines/parse/route.ts:37`; `app/api/fitness/workout/route.ts:17,38`; `components/__tests__/mobile-nav.test.tsx:31,117,126,131-132,135,149-150,153,157`; `lib/data-integrator.ts:440,530,539,542,745,971`; `lib/cognitive/twin-agent.ts:453-454,466`; `lib/db-biometrics.ts:9,46,51,76`; `lib/analytics-server.ts:225-226,238-240`; `lib/ai/executor.ts:8-9,154,170,334,402,404-405,439-491,916,933,940-941`; `lib/ai/actions.ts:76-84,373-374`; `lib/google.ts:200`; `lib/internal-ai/service.ts:5`; `lib/internal-ai/actions/routines.ts:7`; `components/fitness/fitness-tracker.tsx:29,70,94,97,130,157,158,185,189`; `components/analytics/fitness-stats.tsx:9,16,31,70`; `components/ai/modern-chatbot/thinking-steps.tsx:11`; `components/ai/modern-chatbot/blocks/confirmation-block.tsx:45` | Data sync, AI/MCP and API actions, biometrics, analytics, test evidence, legacy tracking, and supporting behavior are retained; none is a primary navigation surface. |

## Verification

- Mobile primary navigation contains Dashboard, Cognitive, Chat, and Activity;
  it excludes Workout.
- The mobile More drawer still navigates Workout to `/routines`.
- The desktop Overview group contains Dashboard, Today, Cognitive, Chat, and
  Activity; Workout remains outside it in More.
- `QuickActions` no longer promotes `New Routine` or `Start Workout`.

No routine dialogs, exercise cards, tabs, session behavior, or routine data flow
were changed.
