# Active Assistant: Device Continuity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the same durable work, results and decisions from Novo web/mobile and the Windows Companion.

**Architecture:** All surfaces consume the owned work/memory APIs from plans 1/2. The PC retains local workspace and execution credentials; web/mobile handles state, scoped cancellation and concrete confirmations. Use bounded polling/reconnect with sequence cursors and the account's existing authorization.

**Tech Stack:** React/Next.js, shared Zod contracts, Prisma, Tauri/TypeScript, current Novo account/device grants.

**Spec:** `docs/superpowers/specs/2026-10-12-novo-active-project-assistant-design.md`; consumes plans 1/2.

## Global Constraints

- Same job ID, state and memory across surfaces; no second account/pairing system.
- Offline PC means waiting device, not completed. Cancelled external requests require reconciliation, not a fake undo.
- Chat keeps its active conversation/attachments; settings remain in Configuración.
- Native phone apps are a later extension; the first remote surface is responsive Novo web.

## Review Focus

1. Reconnect must replay state without submitting a job/action again (task 1).
2. A decision from another account/device must be rejected (task 2).
3. Mobile viewport/keyboard must leave decisions and results reachable (task 3).
4. Cancellation/confirmation racing device execution must use the same job/version (task 2).
5. Stale or expired confirmation must request refreshed concrete evidence (task 2).

### Task 1: Shared work subscriptions

**Files:** Create `hooks/use-project-assistant.ts`, its tests; integrate work cards in `app/activity` and existing chat activity surfaces; modify native work UI.

**Interfaces:** `useProjectAssistant({memoryId?,enabled?})` returns canonical memories/jobs, loading/error, refresh/cancel; bounded visible polling and sequence cursors. Owned GET returns latest phase, available artifact/decision and source/device freshness, never local paths.

- [ ] Write reconnect/duplicate/cancel tests with one shared job across two rendered consumers.
- [ ] Implement fetch/poll/backoff and cancellation; avoid model/provider calls from rendering. Resume from server state after navigation/tab visibility, not copied component state.
- [ ] Run tests and commit.

### Task 2: Cross-surface concrete decisions

**Files:** Create `lib/project-assistant/work-decisions.ts`, `app/api/project-assistant/work/[id]/decision/route.ts`; modify work/device contracts and corresponding tests.

**Interfaces:** `decideProjectWork(userId,id,{revision,decision,operationFingerprint,requestId})` permits confirm/deny of the exact pending decision. `requireWorkStep` from plan 2 consumes the persisted versioned decision.

- [ ] Test owner isolation, repeated confirmation with same request ID, stale fingerprint, cancellation race and expired evidence.
- [ ] Validate schemas/ownership and atomically consume concrete decisions. Refresh stale decisions without rerunning already completed operations. Revocation stops future local steps and preserves uncertain external status for reconciliation.
- [ ] Run route/state/decision tests and commit.

### Task 3: Responsive shared UI and release

**Files:** Modify `components/project-assistant/work-card.tsx`, assistant settings, existing activity/chat surfaces, native UI; add component tests and release documentation.

- [ ] Test loading/auth/empty/error/offline/awaiting-decision/result states, keyboard focus and mobile reachability; configuration stays out of chat.
- [ ] Render actual persisted state and compact progress/decision/result cards. Show which PC runs local work and keep artifacts/result history accessible after switching chat/device.
- [ ] Run full web checks and relevant native tests/build; use `/browse` for desktop/mobile/error flows with isolated data, then verify real deployed boundaries and exact release commit.
- [ ] Publish verified web/native artifacts to GitHub/Vercel under session authorization. Distinguish account checks, protocol/fixture checks and real delegated execution evidence; do not claim native mobile app support.

## Self-review

Spec section 5 and continuity acceptance cases map to tasks 1–3. Review-focus cases map to tasks 1/2/3. Memory and execution remain prerequisite deliverables, not UI-only placeholders.
