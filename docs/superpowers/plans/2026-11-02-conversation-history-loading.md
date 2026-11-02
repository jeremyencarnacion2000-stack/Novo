# Conversation History Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Reduce chat startup transfers and database egress by listing metadata and fetching only the selected conversation, without losing messages, revisions or account isolation.

**Architecture:** Extend the existing owned list API with an opt-in summary response and reuse the existing detail API. The existing ChatbotProvider owns detail loading and loaded-state guards; existing web/mobile chat controls render loading and retry feedback. No new persistence or service.

**Tech Stack:** Existing Next.js App Router, Prisma, React and Jest.

**Spec:** User's Novo Cognitive OS directive (sections 2, 8, 9, 14–17); [roadmap stage 1](../../roadmap/NOVO_EVOLUTION.md) and [documented history risk](../../architecture/TECHNICAL_DEBT.md).

## Global Constraints

- Preserve existing working functionality.
- Avoid duplicate implementations and unnecessary dependencies.
- Minimize AI inference costs; no AI call is required for loading history.
- Never expose credentials or sensitive user data.
- Preserve ownership filters, revision conflicts and confirmation of consequential actions.
- Do not mutate or migrate stored conversations to optimize their reads.
- Keep the default list contract compatible; only the web client opts into summaries.

## Review Focus

- A delayed autosave must never replace an unread history with an empty placeholder (Task 2).
- Rapid selections, new-chat creation and deleted targets must invalidate stale detail responses (Task 2).
- Responses and failed-delete rollback from another account must not enter the current account (Task 2).
- Legacy messages must retain stable IDs and extensions such as attachments, review blocks and provenance (Tasks 1–2).
- Unavailable history must offer retry, preserve the composer and block sending/editing/actions until loaded (Task 2).

## Task 1: compatible list summaries and stable detail

**Files:** `app/api/ai-conversations/route.ts`, `[id]/route.ts` and their existing tests.

**Interfaces:** `GET /api/ai-conversations?view=summary` returns only `id`, `title`, `createdAt`, `updatedAt`, `revision`; default GET retains its full response. Existing owned detail GET supplies messages, using the existing canonical message normalizer for legacy IDs/timestamps.

- [x] Add failing tests: summary DB projection excludes messages; owner/limit/order preserved; default GET remains compatible; unauthenticated reads do not query DB; detail normalizes legacy messages and preserves extensions/404.
- [x] Run the two route test files and observe the expected failures.
- [x] Implement the opt-in select and reuse canonicalConversationMessages for detail GET. Keep existing writes unchanged.
- [x] Run route tests, inspect failures, and verify whitespace.
- [x] Commit this independently compatible API change.

## Task 2: selected detail with safe persistence and feedback

**Files:** `components/ai/modern-chatbot/{context.tsx,types.ts,index.tsx,chat-area.tsx}`, a new focused `__tests__/history-loading.test.tsx`, and affected existing fixtures/tests.

**Interfaces:** `Conversation.messagesLoaded?: boolean` is false only for unread metadata placeholders; it is local UI state, never stored. Context adds `historyStatus: 'loading' | 'ready' | 'error'` and `retryHistoryLoad(): void`. The public selection setter and existing message/action methods remain compatible.

- [x] Add failing provider tests for one selected detail request, deferred errors/retry, selection/new-chat/deletion/account races, and no saves of unread or captured placeholder snapshots.
- [x] Add tests that loaded history preserves attachments/blocks/provenance and is included when sending; sending/editing/actions are blocked before hydration. Cover failed-delete rollback after account switch.
- [x] Request summaries, accept legacy full list responses during rollout, and fetch detail with an AbortController plus account/selection checks. Recover existing mail-review blocks and preserve all valid message extensions.
- [x] Guard saves using the captured conversation's loaded flag; never install an unread snapshot/revision as a saved history. Detail hydration records its snapshot without skipping unrelated pending saves.
- [x] Keep new local conversations loaded, protect updates/retry/actions, and prevent deleted/old-account rows from being restored by late work.
- [x] Render an accessible history-loading/error/retry state in the existing ChatArea; disable the composer while unavailable without remounting or clearing its draft. Preserve materials/motion and new-chat escape from a failed detail.
- [x] Run focused provider/UI/API tests and lint. Commit the working client migration.

## Task 3: measured verification and release

**Interfaces:** No new runtime contract. Update existing capability/debt/implementation documents with actual evidence and limits.

- [x] Measure total initial JSON bytes for 200 representative synthetic histories: old full list versus summary list plus one detail; report this as a fixture, not a production bill.
- [x] Run relevant regression checks and complete remote type/build validation if the local machine cannot sustain them.
- [x] Request one fresh-context review of the whole branch; fix important findings with observed red/green tests.
- [x] Publish using the user's existing GitHub/Vercel authorization. Verify the compiled result and an authenticated read-only flow; do not send mail or modify real histories for QA.
- [x] Update the required documentation and report exactly what was tested and what remains uncertain.

Release evidence: PR #31 merged as `b882c82`; CI `41397618757` passes types/lint/1336 tests. Production Vercel deployment READY, canonical alias verified. Authenticated read-only QA: 75 metadata rows without messages, one initial detail retaining sources, one detail for another selected history, zero history writes. See the performance report for measured bytes and limits.

## Execution rulings

The user already chose implementation here and explicitly asked to continue the existing roadmap. This is its previously documented history-loading step, not a new architecture or permission expansion; no repeated execution-choice approval is needed.

Reuse the clean linked worktree and create a task branch from current main. The original checkout remains untouched. On Windows, use the existing ignored `.codex/perf/history-loading` scratch directory and native PowerShell ledger instead of shell-only skill bookkeeping; preserve the plan identity and red/green evidence there.
