# Active Assistant: Memory and Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist verified project identities and context, reconcile important work and update the Twin between conversations.

**Architecture:** Extend the current project/context and ambient pipelines with two owned tables: a canonical memory record and its bounded source observations. Reuse provider readers and the Signal Ledger; selected local workspaces send metadata through the existing device authorization. Durable delegated work and remote decisions are covered by plans 2 and 3.

**Tech Stack:** Next.js App Router, TypeScript, Prisma/PostgreSQL, Zod, Inngest, React, Tauri/Rust.

**Spec:** `docs/superpowers/specs/2026-10-12-novo-active-project-assistant-design.md` (approved by the user).

## Global Constraints

- Remote refresh every 15 minutes; the current daily Vercel cron is a fallback, not proof of that cadence.
- Preserve manual corrections, existing projects/chats/attachments and source exclusions.
- Full local paths, credentials and raw transcripts stay off the transport and memory.
- Owner filtering, server validation, additive migrations and deterministic deduplication are mandatory.
- High-priority active projects/tasks and explicitly followed projects qualify for tracking; tracking grants no execution permission.
- Operational logs: 30 days; essential memory survives chat expiry and remains correctable/deletable.

## Review Focus

1. Matching names with conflicting repositories must never join records (task 1).
2. Worker refresh must not overwrite a user correction or resurrect cleared memory (task 2).
3. Excluded/revoked providers and devices must disappear from usable context (task 3).
4. Provider failure must preserve the last observation with its old timestamp (task 4).
5. Duplicate native inventory and overlapping workers must be idempotent (tasks 2/4).

### Task 1: Contracts and additive storage

**Files:** Create `lib/project-assistant/contracts.ts`, `lib/project-assistant/identity.ts`, their `__tests__`; modify `prisma/schema.prisma`; create migration `20261012160000_add_project_assistant_memory`.

**Interfaces:** `ProjectObservation` is a strict bounded union of novo/github/vercel/folder/agent observations. `AssistantMemoryView` contains id, title, linkedProjectId, trackingMode, revision, sources/freshness, task/blocker counts, nextStep and corrected note. `resolveObservationIdentity(existing, observation)` returns existing/new/conflict; only stable repo/Vercel/Novo/workspace identifiers bind.

- [ ] Write contract/identity tests asserting unsafe URLs/paths/secrets rejected, source limits enforced, equal names remain candidates, conflicting repos return conflict, distinct workspaces share a project by repo.
- [ ] Run `npm test -- --runInBand lib/project-assistant/__tests__/identity.test.ts lib/project-assistant/__tests__/contracts.test.ts` and verify the new interfaces are missing.
- [ ] Add `ProjectAssistantMemory` (owner, optional owned Project relation, title, mode auto/on/off, correction, revision, clearedAt) and `ProjectAssistantSource` (owner, memory, kind, sourceKey, optional device UUID, bounded facts JSON, observedAt). Unique `(userId,kind,sourceKey)` and query indexes; deletion of a linked project cascades its memory. Preserve tombstones for explicit forgetting.
- [ ] Implement strict schemas, normalization and conservative identity resolution; generate Prisma, validate schema and rerun the tests.
- [ ] Commit only these files and the migration.

### Task 2: Owned persistence and settings APIs

**Files:** Create `lib/project-assistant/memory.ts`, `lib/project-assistant/http.ts`, `app/api/project-assistant/route.ts`, `app/api/project-assistant/[id]/route.ts`, corresponding tests.

**Interfaces:** `recordProjectObservations(userId, observations, {deviceId?})`; `readProjectAssistantMemories(userId, {query?, access, now?})`; `updateProjectAssistantMemory(userId,id,{revision,trackingMode?,correction?})`; `clearProjectAssistantMemory(userId,id,revision)`. Access includes personal/projects/integrations/development/currentWorkContext; mutations expose only allowed fields.

- [ ] Write tests for persistent identity across requests, correction preservation, clearing/tombstones, ownership and stale revision conflicts; duplicate observations must not create duplicate sources/evolution events.
- [ ] Run the memory/route tests and confirm failure before implementing storage.
- [ ] Implement source upserts inside `withProviderSyncLock`; reject older observations, conflicting bindings and foreign Project IDs. Persist only validated structured facts, not arbitrary provider/model JSON. GET returns no credentials/raw paths; PUT/DELETE use session ownership and strict Zod input.
- [ ] Run tests; assert a refresh after correction leaves `correction` intact, and an older retry after forgetting cannot restore usable memory.
- [ ] Commit the storage service and routes.

### Task 3: Query and Twin integration

**Files:** Modify `lib/ai/project-query-context.ts`, `lib/ai/chat-service.ts`, `lib/cognitive/ambient-twin-runtime.ts`, `lib/companion/devices.ts`; create `lib/project-assistant/context.ts`; update targeted tests.

**Interfaces:** `buildProjectAssistantContext(userId,query,access): Promise<{text,sources}>`; `reconcileNovoProjectMemories(userId): Promise<{changed,tracked}>`. Native context cannot grant extra scopes; remembered sources obey current exclusions and active device grants.

- [ ] Add tests proving a second chat can recover linked project state without hints, narrow project permission excludes provider/local facts, revocation/exclusion removes source usability, and memory data never becomes instructions.
- [ ] Run those tests to expose the missing persistent context path.
- [ ] Persist safe evidence from real query readers, then retrieve relevant memory before composing the prompt. Reconcile task priority/status/deadlines and deterministic blockers into a project-specific ledger/evolution event only when the state fingerprint changes. Keep user fields unchanged; invalid timestamps do not make facts fresh.
- [ ] Filter local sources by active device at read time; revoke removes their usable observations. Run chat, context, Twin and device regression suites.
- [ ] Commit the integrated context path.

### Task 4: Background refresh and local inventory

**Files:** Create `lib/project-assistant/refresh.ts`, `lib/inngest/functions/project-assistant-refresh.ts`, `app/api/companion/project-observations/route.ts`; modify `app/api/inngest/route.ts`, `lib/cognitive/ambient-context-refresh.ts`; create `companion/windows/src-tauri/src/workspace_catalog.rs`; modify native `lib.rs`, `companion.rs`, `context_folders.rs`.

**Interfaces:** `refreshProjectAssistantForUser(userId,{minIntervalMs?})`; `refreshProjectAssistantBatch(limit=100)`. `WorkspaceDescriptor` uses stable local UUID plus safe name/repository/Vercel/branch/commit/dirty-count metadata. `workspace_catalog::inventory()` and `resolve_workspace(id)` retain canonical paths locally and honor selected folders. Native POST requires active device plus work-context-write; optional Novo linkage also requires project read.

- [ ] Add tests for paused sources, failed reads preserving timestamps, duplicate delivery, concurrent refresh leases, foreign-device rejection and inventory without paths/content/secrets.
- [ ] Confirm test failures; implement the 15-minute Inngest cron using persisted leases/concurrency limits, with existing daily fallback. Query owned selected providers outside DB locks and apply normalized observations inside the lock. A source error records availability separately, not invented current facts.
- [ ] Implement bounded/debounced local inventory, atomic stable workspace IDs and a sync loop that checks account/grant changes. Agent observations bind only to selected workspaces; initial folder sync must not read whole Codex history.
- [ ] Run targeted TypeScript/native tests and verify actual scheduler registration/configuration. If unavailable, report activation blocked explicitly and use the authorized local/interactive lanes without claiming closed-browser cloud cadence.
- [ ] Commit the reconciler, scheduler and native inventory.

### Task 5: Correctable tracking UI and release checks

**Files:** Create `components/settings/settings-project-assistant.tsx`; modify `components/settings/settings-twin.tsx`, native `src/settings/novo-chat.ts`; add component tests and integration documentation.

**Interfaces:** Shared REST views from task 2; settings UI exposes selection, source/freshness, correction, forgetting and pause. The native settings link opens the same account configuration; chat gets only compact work/context cards.

- [ ] Add tests for loading/auth/error/empty states, correction conflict, source freshness and access from a narrow mobile viewport.
- [ ] Implement the settings panel with Novo identity and reachable controls; preserve current chat/input and motion behavior. Add a compact project snapshot surface without copying configuration into chat.
- [ ] Run targeted suites, relevant lint, schema validation, full web tests and cloud build. Exercise authenticated/unauthenticated/error/mobile states with `/browse` and isolated fixtures, without presenting fixture results as real account verification.
- [ ] Review the diff and apply the additive migration through Prisma only after build/checks pass. Publish to GitHub/Vercel under the session's deployment authorization; verify exact commit/alias. Native changes require a built/reviewed new installer and release, not a claim that installed 0.2.7 contains them.

## Self-review

This plan implements spec sections 1/2/6 and their configuration surfaces. All five review-focus cases have tests. Execution, persistent delegations, operational retention and device decisions are implemented by plans 2/3; completing this plan alone does not complete the approved project.
