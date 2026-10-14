# Active Assistant Operability Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task-by-task. Work remains inline, as the user selected earlier.

**Goal:** Make Novo's project follow-up, Windows Codex preparation, and two approved provider actions operable with observable status and safe failure handling.

**Architecture:** Keep the current GitHub Actions 15-minute refresh lane and require a real scheduled-run receipt before claiming it works. Reuse the Companion's existing Windows filesystem probe with the provisioned `elevated` sandbox. Extend the existing owner-bound ProjectWork approval record for two typed provider mutations; dispatch only after the confirmation transaction commits and persist the result or uncertainty as a sequenced work event.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma/Postgres, Zod, GitHub REST API, Vercel REST API, Tauri/Rust, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-14-active-assistant-operability.md`

## Global Constraints

- Validate every mutable API input with strict Zod schemas and verify all resources belong to the authenticated owner.
- Keep provider credentials server-side and never put tokens, private provider errors, or private project contents in logs or client responses.
- Do not run model-generated commands outside the per-workspace Windows sandbox; fail closed when its probe fails.
- Remote mutations require explicit approval bound to owner, work revision, request ID, and operation fingerprint.
- Persist an idempotent dispatch claim and audit result; never automatically replay a write whose provider outcome is uncertain.
- Preserve existing local changes; make database changes additive and deploy through Prisma if any schema change proves necessary.

## Review Focus

- GitHub scheduler is active but emits no `schedule` event: preserve the 15-minute freshness requirement and report the actual last event.
- Windows sandbox allows an unintended read or write: Codex capability must remain unavailable unless the probe denies it.
- GitHub token lacks repository write scope or the named repository: do not dispatch; return a safe connection/permission error.
- Vercel project is not selected or the deployment belongs to a different project: do not dispatch.
- Provider accepts a write but the response is lost: persist `uncertain`, block duplicate execution, and expose the reconciliation state.

---

### Task 1: Prove the scheduled refresh is running

**Files:** `.github/workflows/project-assistant-refresh.yml`, `docs/superpowers/plans/2026-10-14-active-assistant-operability.md`

- [ ] Inspect the workflow run history after the explicit reactivation and record the first `schedule` event and conclusion.
- [ ] If no scheduled event appears, make the smallest workflow registration change and ship it through the approved GitHub/Vercel release path; do not add a Vercel Hobby cron that runs less often than the freshness contract.
- [ ] Verify a scheduled run reaches `/api/cron/project-assistant` and completes successfully; retain the run URL in the release ledger.

### Task 2: Use the supported Windows sandbox fallback

**Files:** `companion/windows/src-tauri/src/project_work/codex.rs`, `companion/windows/src-tauri/src/project_work/mod.rs`, `companion/windows/src-tauri/Cargo.toml`, `companion/windows/package.json`, `companion/windows/package-lock.json`, `companion/windows/Cargo.lock`, `companion/windows/src-tauri/tauri.conf.json`

- [x] Add a Rust unit test asserting the Codex permission arguments choose the supported Windows `elevated` fallback, deny secrets and environment files, and keep network disabled.
- [ ] Run the test and confirm it fails while the arguments still select MXC.
- [x] Change the per-run Codex setting from `mxc` to `elevated`; retain the exact workspace/read-only probe and all denied-path rules.
- [ ] Run the sandbox probe on Windows; verify the workspace write succeeds, a neighboring path is unreadable, and read-only dependency links cannot be written.
- [ ] Verify Codex is reported available only when the probe passes and Claude remains unavailable without an installed, safely contained CLI.
- [ ] Publish the passing 0.2.9 Windows installers as a new GitHub release; do not overwrite the already-published 0.2.8 release.

### Task 3: Add approved GitHub and Vercel actions

**Files:** `lib/project-assistant/service-actions.ts`, `lib/project-assistant/work-decisions.ts`, `lib/project-assistant/work-contracts.ts`, `lib/project-assistant/__tests__/work-decisions.test.ts`, `lib/project-assistant/provider-actions.ts`, `components/project-assistant/work-card.tsx`

- [x] Add failing schema and decision tests for exact GitHub issue and Vercel redeployment operations; assert owner binding, approval, revision/fingerprint validation, and no dispatch before approval.
- [x] Add owner-scoped provider adapters. Check GitHub `repo` scope and Vercel's selected-project/deployment binding before the POST.
- [x] Commit the confirmation as `executing` under the existing user lock, dispatch outside the database transaction, then store `applied`, `failed`, or `uncertain` with a sanitized event. Replays of an in-flight or terminal request must not dispatch again.
- [x] Show the exact repository, issue text, Vercel deployment ID, and target in the review card; show safe completion and uncertainty states.
- [x] Refresh connected provider observations after success when possible; do not reverse a successful provider write if observation refresh fails.

### Task 4: Release verification

- [x] Run focused Jest suites and full project tests (290 suites, 1,121 tests, 2 snapshots passed).
- [x] Run lint and Prisma validation; lint retains two existing font preload warnings in `app/layout.tsx`.
- [ ] Complete TypeScript verification and Windows Companion CI on GitHub; local TypeScript and Cargo builds were stopped because the host remained saturated without output.
- [ ] Review the branch diff for credential exposure, unbounded URL/command execution, duplicate remote writes, and owner-filter omissions.
- [ ] Deploy only after checks pass, then verify the production workflow's scheduled run and the Companion Windows release.

## Verification ledger

- The last observed production refresh workflow run is successful `workflow_dispatch` run [38629955211](https://github.com/jeremyencarnacion2000-stack/Novo/actions/runs/38629955211). As of 2026-10-14 23:07 UTC, no post-reactivation `schedule` event had appeared. The cron offset is shifted to `10,25,40,55` while retaining 15-minute intervals; verify an actual scheduled receipt after the update reaches `main`.
- The Windows Companion installer has not been rebuilt or published from this change yet. Windows CI must pass before release.
- Local `npm run build` and local Windows native builds were intentionally avoided due to prior disk pressure and host saturation; Vercel and GitHub CI will provide those checks.
