# Phase 2 release gates

Baseline recorded: 2026-08-10T00:06:03-04:00
Scope: non-destructive Phase 2 release-gate baseline. This ledger records only
observed state. Later tasks may change a row from `OPEN` to `PASS` only with the
command output and timestamp that supports it.

## Task 8 certification — 2026-08-11T13:18:45-04:00

**Phase 2 verdict: NOT PASS.** Static verification is green, but the required
fresh clean-database, isolated-E2E, authenticated visual, and build/READY
Preview evidence is absent. This certification makes no claim that the
corrected Ambient architecture has provider E2E, deployed scheduling, Preview
validation, automatic plan changes, or autonomous external writes.

### Post-report TypeScript rerun — 2026-08-11

After this report was recorded, the coordinator reran the strict TypeScript
command, `node --max-old-space-size=4096 ./node_modules/typescript/bin/tsc
--noEmit --pretty false --incremental`. It exceeded the 120-second observation
window without diagnostics and was not a completed pass. Accordingly, this
ledger makes **no newer TypeScript pass claim**. The earlier 79.1-second exit-0
result below is retained only as historical command evidence from the original
Task 8 certification; it does not certify the later rerun or any release gate.

| Release gate | Status | Baseline evidence |
| --- | --- | --- |
| clean migration chain | NOT PASS | No fresh disposable-DB `migrate deploy`, `migrate status`, and `validate` certificate was run. Phase 1's known `P3018` / PostgreSQL `42P01` history is not a current clean-chain pass. |
| isolated E2E environment | BLOCKED_EXTERNAL | No valid isolated test-branch credential was provided or verified. No production database was contacted. |
| isolated E2E lifecycle | BLOCKED_EXTERNAL | The required isolated lifecycle suite was not run because its prerequisite isolated credential/environment remains unavailable. |
| production build | NOT PASS | `npm run build` was started locally, then ended after a bounded approximately four-minute attempt at coordinator direction; no `.next/BUILD_ID` exists. **LOCAL BUILD INCONCLUSIVE**, not a pass. |
| Preview deployment | BLOCKED_EXTERNAL | Vercel CLI is installed and a local project link exists, but no non-interactively verified authorized Preview target/URL, READY deployment, build log, HTTP route matrix, or screenshots were available. No deployment was performed. |
| material stress | NOT PASS | Automated material tests passed, but the required authenticated desktop and 390px Settings/Dashboard captures and measured contrast ratios for all five cases are absent. |
| mobile overlays | NOT PASS | The targeted policy test covers 320/360/390/412/430px and passed, but no fresh browser/Preview visual capture verifies modal, sheet, keyboard, and safe-area behavior. |
| Workout decision | PASS | `WORKOUT-DECISION.md` records Option B and targeted navigation/routine tests passed in this certification. |
| Cognitive regression | NOT PASS | The focused Cognitive command-surface test passed, but no fresh authenticated Cognitive smoke capture exists. |
| final diff check | PASS | Fresh `git diff --check` completed with exit code 0. CRLF conversion warnings were emitted for existing worktree files; no whitespace error was reported. |

## Task 8 command evidence

All commands below were run on 2026-08-11 in this worktree. The focused test
set was selected from the Phase 2 material, mobile-overlay, Workout, and
Cognitive surfaces; it is not a substitute for the full isolated-E2E gate.

| Command | Exit code | Observed result |
| --- | --- | --- |
| `npm test -- --runInBand components/settings/__tests__/settings-personalization.test.tsx lib/__tests__/material-contract.test.ts components/__tests__/mobile-overlay-policy.test.tsx components/__tests__/mobile-nav.test.tsx components/routines/__tests__/routine-mobile-layout.test.tsx components/cognitive/__tests__/cognitive-command-surface.test.tsx components/ui/__tests__/sidebar-material.test.ts app/globals.test.ts` | 0 | 8 suites passed; 45 tests passed; 0 snapshots. The runner emitted only the stale `baseline-browser-mapping` advisory. |
| `node --max-old-space-size=4096 ./node_modules/typescript/bin/tsc --noEmit --pretty false --incremental` | 0 (historical) | Historical Task 8 command evidence only: passed in 79.1 seconds after two test-only callback/narrowing corrections. No TypeScript diagnostics remained in that completed run. The later 2026-08-11 rerun exceeded 120 seconds without diagnostics and is inconclusive, not a newer pass. |
| `npm run lint` | 0 | 0 errors, 6 warnings: `app/layout.tsx` (2 custom-font warnings), `app/music/artist/[id]/page.tsx` (3 image-alt warnings), and `prisma.config.ts` (1 anonymous-default-export warning). The stale `baseline-browser-mapping` advisory was also emitted. |
| `git diff --check` | 0 | No whitespace errors. Existing CRLF conversion warnings do not establish a clean worktree. |
| `npm run build` | inconclusive | Started; ended after a bounded approximately four-minute local attempt at coordinator direction. No `.next/BUILD_ID` was present afterward. This is **LOCAL BUILD INCONCLUSIVE**, never a production-build pass. |

## Preview and route availability

The machine has a Vercel CLI and local project-link metadata, but the
noninteractive check did not yield a verifiable authorized account or a Preview
deployment URL. Environment-token presence checks were false; no credential
values were read or logged. Therefore Task 8 did not create a deployment or
perform HTTP requests. The required route matrix is recorded in
`preview/README.md` as unavailable, rather than inventing status codes.

## Remaining exit gates

1. Run clean migration deploy/status/validate on a disposable, non-production database.
2. Verify valid isolated credentials and run the complete isolated E2E lifecycle suite.
3. Obtain an authorized Vercel Preview deployment, capture its TypeScript and route-generation build logs, confirm `READY`, and record HTTP statuses for `/`, `/today`, `/cognitive`, `/chat`, `/activity`, `/routines`, and `/auth/signin`.
4. Capture authenticated desktop and 390px material evidence for dark, bright, high-detail, light-mode, and dark-mode cases, including measured text contrast ratios.
5. Capture the five required mobile widths plus modal, sheet, keyboard, safe-area, and Back behavior in a browser/Preview session.
6. Capture a fresh authenticated Cognitive smoke state.

## Read-only command evidence

Executed 2026-08-10T00:06:03-04:00. Database hosts, usernames, and connection
strings are intentionally redacted.

| Command | Exit code | Observed result |
| --- | --- | --- |
| `npx prisma migrate status --schema prisma/schema.prisma` | 0 | Configured database reports 23 migrations found and schema up to date. This only establishes configured-database status; it does not certify an empty-database migration chain. |
| `npx prisma validate --schema prisma/schema.prisma` | 0 | `prisma/schema.prisma` is valid. |
| `git diff --check` | 0 | Completed without whitespace errors. Existing-worktree CRLF warnings were emitted and do not constitute a pass for the final release gate. |

## Historical migration assumption

The focused migration-history search found no reference to `cognitive_twin_records`
in migrations earlier than `20260801120000_remove_uncalibrated_twin_bootstrap`,
and no `CREATE TABLE` statement for that relation anywhere in the migration chain.
The failing migration itself executes `ALTER TABLE "cognitive_twin_records"` and
then updates that table. A later migration,
`20260809123000_add_onboarding_completed_at`, also alters it. This establishes the
specific missing historical condition that the bridge must repair: the relation
must be created before the failing migration runs on an empty database.

Focused search output:

```text
rg -l -i 'cognitive_twin_records|behavioral_signals|twin_evolution_logs|twin_snapshots' prisma/migrations -g migration.sql
prisma/migrations/20260728190000_add_query_performance_indexes/migration.sql
prisma/migrations/20260801120000_remove_uncalibrated_twin_bootstrap/migration.sql
prisma/migrations/20260809123000_add_onboarding_completed_at/migration.sql

Earlier-migration references to cognitive_twin_records: none
CREATE TABLE cognitive_twin_records matches: none
```

Source: Phase 1 recertification report at
`docs/audit-evidence/phase1-current-auth/PHASE1-RECERTIFICATION.md`.
