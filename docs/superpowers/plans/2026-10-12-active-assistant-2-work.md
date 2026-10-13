# Active Assistant: Delegated Work Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute bounded, persistent project delegations with durable status and verified results through local Codex/Claude adapters.

**Architecture:** Store delegation rules and jobs separately from 30-minute chat activity. A device claims a fenced job lease, runs a registered capability against its selected workspace and reports typed evidence; owner cancellation/revocation and rule revision gate each step. Publication remains a distinct confirmed operation.

**Tech Stack:** TypeScript/Zod/Prisma, PostgreSQL advisory locks, Tauri/Rust subprocesses, installed Codex CLI JSONL and installed Claude CLI when supported.

**Spec:** `docs/superpowers/specs/2026-10-12-novo-active-project-assistant-design.md`; consumes plan 1 memory and workspace contracts.

## Global Constraints

- One active automatic job per project; default three automatic starts per day in the user's timezone, configurable and deduplicated by trigger evidence.
- Rule versions and permissions checked before each step; no model-provided shell commands or publication privileges.
- No bypass flags, unrestricted sandbox, new paid provider or silently copied credentials.
- Codex jobs use documented `exec --json`/stdin and explicit sandbox. Installed CLI observed: 0.162.0-alpha.17.2; negotiate flags/version before advertising availability. Claude is currently absent from PATH and must be shown unavailable until a supported installation is detected.
- Preserve user checkout; preparing changes uses a separate managed workspace at a recorded base commit. Dirty local state is reported and never silently overwritten.
- Essential result persists; detailed operational events expire after 30 days.

## Review Focus

1. Expired lease or duplicate delivery must never run a job twice (task 2).
2. Paused/revised delegation must prevent the next step (tasks 1/2).
3. Provider/repo/file text is untrusted and cannot expand capability scope (task 3).
4. Agent completion without verification must not mark a fix resolved (task 4).
5. Offline device/unsupported runtime must remain waiting/unavailable (tasks 2/3).

### Task 1: Delegation and job contracts/storage

**Files:** Create `lib/project-assistant/work-contracts.ts`, `delegations.ts`, `jobs.ts`, their tests; modify Prisma and add migration `20261012170000_add_project_assistant_jobs`.

**Interfaces:** Capabilities `project.diagnose`, `codex.prepare_fix`, `claude.prepare_fix`. `ProjectDelegation` contains owned memory/workspace/device binding, capabilities, enabled, version, dailyLimit. `ProjectWork` contains unique trigger/request identity, objective, capability, frozen scope/ruleVersion, lease token/version/expiry, phase and verified result. Phases: pending/running/awaiting_confirmation/waiting_device/completed/failed/cancelled/uncertain.

- [ ] Write tests asserting explicit delegation activation, no jobs from tracking alone, limits 1/3, repeated CI/deploy trigger coalescing, manual requests excluded from automatic daily starts and foreign binding rejection.
- [ ] Confirm failures; add additive models/indexes and strict schemas. Expose `saveDelegation(userId,input)`, `enqueueProjectWork(userId,input)` and `cancelProjectWork(userId,id)` with per-owner/project atomic locks and stable request keys.
- [ ] Persist rule versions; restrict frozen args to owned memory/workspace and safe objective. Only deterministic new failure/deadline/blocker evidence can trigger an enabled rule's listed capability.
- [ ] Run tests/schema validation, then commit.

### Task 2: Device claim/report and fenced execution

**Files:** Create `lib/project-assistant/device-work.ts`, `app/api/companion/work/route.ts`, `app/api/companion/work/[id]/route.ts`, `app/api/project-assistant/work/route.ts`, `app/api/project-assistant/work/[id]/route.ts`; modify capability/scope catalogs and native account contract/requested scopes; add route tests.

**Interfaces:** `claimDeviceWork(actor,deviceId): Promise<DeviceWorkClaim|null>`; `reportDeviceWork(actor,id,{leaseToken,sequence,event})`; `requireWorkStep(actor,id,leaseToken)`. New explicit scopes `device:work:read`/`device:work:execute` must be requested via reauthorization and validated against the active device grant.

- [ ] Add tests for two devices racing, expired/replayed lease reports, revocation, stale rule version, cancellation, foreign job IDs and reordered sequences.
- [ ] Implement claim/heartbeat/report transaction fencing. Claimed local work that loses contact becomes uncertain and must reconcile its saved execution identity before retrying. No automatic reassignment to an unrelated workspace/device.
- [ ] Native claim polls only when enabled and authorized. Check `requireWorkStep` before launching/continuing each trusted step; retain a local receipt before spawn and after outcome.
- [ ] Run route/auth/state-machine tests and commit.

### Task 3: Local controlled agent adapters

**Files:** Create native `src-tauri/src/project_work/{mod,codex,claude,workspace,protocol}.rs`; modify `lib.rs`, `companion.rs`, `settings.rs`; add Rust unit/protocol tests and native UI availability contract.

**Interfaces:** `available_capabilities()` returns detected runtime/version/scopes; `run_work(claim,cancel)` emits bounded typed phases/evidence. Workspace resolution consumes only task 4 of plan 1. `AgentResult` contains session ID, artifact reference, base commit, changed paths, diff hash, verification status and safe summary.

- [ ] Test argv/stdin construction, JSONL size limits, path containment/symlink escape, no raw credentials in events, timeout/cancellation and missing runtime.
- [ ] Create an isolated workspace preserving the selected checkout. Invoke installed Codex without a shell, prompt via stdin, explicit read-only/workspace-write sandbox, approval policy never, network disabled and no dangerous bypass flags. Select the user's configured model; do not invent a model or credentials. Unsupported flags/sandbox fail closed.
- [ ] Parse documented thread/turn/item events; final JSON is validated before use. Cancel the owned process tree and keep artifacts for review. Never execute any command received from the server/model directly.
- [ ] Implement Claude adapter only with detected documented flags/tool controls; capabilities with unavailable confinement/transport stay unavailable with a reason. No automatic installation/authentication.
- [ ] Run native tests and compile; smoke-check detection/structured fixtures without claiming a real account run. Commit adapters.

### Task 4: Verification, persistent outcomes and automation triggers

**Files:** Create `lib/project-assistant/work-results.ts`, `work-triggers.ts`; modify refresh/reconciliation and native workspace/protocol adapters; add targeted tests.

**Interfaces:** `acceptVerifiedWorkResult(userId,jobId,result)` verifies current lease/scope/evidence and updates memory/Twin. `dispatchDelegationTriggers(userId,observations)` queues only matching new evidence. Verification commands are explicitly configured and frozen with the delegation; execute them inside the same restricted runtime, never as unrestricted host shell commands.

- [ ] Test failed/missing verification, changed base/manifest, duplicate outcome, no-op correction, repeated unchanged blocker, daily quota and stale source evidence.
- [ ] Verify patch path containment, bounded safe artifacts and base commit. Store factual prepared-result evidence; a prepared change is not a published fix. Record uncertainty if execution exited without the expected receipt/evidence. Keep manual task fields unchanged unless that exact operation was delegated.
- [ ] Update memory and ledger/evolution atomically once per successful result. Feed subsequent chat/refresh with persisted outcome; prune only operational details older than 30 days.
- [ ] Run state/result/trigger/native suites and commit.

### Task 5: Delegation controls and useful service operations

**Files:** Modify shared assistant settings; create `components/project-assistant/work-card.tsx`; modify native `src/settings/novo-chat.ts`; add `lib/project-assistant/service-actions.ts` with tests.

**Interfaces:** Shared owned jobs/delegations REST; a compact card shows actual phase/result/decision and links artifacts. Reuse confirmed Calendar and registered internal task/note actions through typed adapters; each service advertises only implemented operations and permission requirements.

- [ ] Test selection/activation/pause, missing device/scope, failed job, cancellation and confirmation with stable arguments/fingerprint.
- [ ] Implement settings and cards; distinguish execution permission from following a project. Expose unsupported agents/services honestly, preserve one Novo account/configuration and current conversations.
- [ ] Make externally visible mutations require a concrete user approval bound to operation/arguments/result, idempotent retry and audit. Never route arbitrary agent text into legacy mutation handlers.
- [ ] Run web/native suites, lint/build and whole-branch review. Publish additive migration/web/native installer only after verification under existing authorization.

## Self-review

Spec sections 3/4 and persistent-rule acceptance cases map to tasks 1–5. All five review-focus cases are tested. Web/mobile continuity and per-job decisions from another surface follow plan 3. No dormant legacy Twin capability is re-enabled wholesale.
