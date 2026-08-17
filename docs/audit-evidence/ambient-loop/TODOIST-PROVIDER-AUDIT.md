# Todoist provider audit — real human proof checkpoint

Date: 2026-08-11

## Existing reusable paths

- OAuth and ownership: `app/api/integration/todoist/connect`, `callback`, and `route.ts`.
- REST client: `lib/todoist.ts`.
- Bounded active/completion pull: `lib/cognitive-reconciliation/todoist-reconciliation-client.ts`.
- Policy/service tests: `lib/cognitive-reconciliation/todoist-human-reconciliation.ts` and its tests.

## Gaps blocking the real-human certificate

- No deterministic link endpoint writes `ExternalEntityMapping`.
- Existing `ChecklistItem.source/sourceId` is not the new durable mapping boundary.
- No Todoist provider-account identity is persisted for mapping scope.
- No server-side route/cron claims a durable sync unit and invokes canonical verification.
- Existing completion activity pull is a bounded rolling window, not a durable provider cursor.
- No webhook delivery/signature path; the honest first implementation must be `SERVER-SIDE SYNC FALLBACK`.
- Legacy plugin sync does not produce idempotent OutcomeEvent/Activity/recommendation updates.
- OAuth token refresh/revocation and safe provider error classification are incomplete.
- No persistent correction/unlink API exists for rejected mappings.

## Safety decision

Do not claim the real-human proof yet. The existing connector can be reused, but wiring it directly would risk disappearance-as-completion, duplicate downstream effects, and non-durable background behavior. The next implementation block is a narrowly scoped deterministic-link + server-side sync fallback using `ExternalEntityMapping`, `AmbientReconciliationClaim`, canonical fetch, and the existing reconciliation boundary. No production deployment or webhook simulation is authorized.

## Current mode

`SERVER-SIDE SYNC FALLBACK` is not implemented or certified. Isolated E2E remains `BLOCKED_EXTERNAL` pending disposable/Neon credentials.
