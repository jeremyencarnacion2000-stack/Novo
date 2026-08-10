# Phase 2 release gates

Baseline recorded: 2026-08-10T00:06:03-04:00
Scope: non-destructive Phase 2 release-gate baseline. This ledger records only
observed state. Later tasks may change a row from `OPEN` to `PASS` only with the
command output and timestamp that supports it.

| Release gate | Status | Baseline evidence |
| --- | --- | --- |
| clean migration chain | OPEN | Phase 1 reports the known clean-chain failure: Prisma `P3018` / PostgreSQL `42P01` at `20260801120000_remove_uncalibrated_twin_bootstrap`. The configured-database status below is not a clean-chain certificate. |
| isolated E2E environment | OPEN | Phase 1 reports that configured Neon test-branch credentials rejected authentication. |
| isolated E2E lifecycle | OPEN | Phase 1 reports Phase 9 was not run; an operative GO cannot be declared. |
| production build | OPEN | Phase 1 reports the attempted production build did not complete within 15 minutes and produced no `.next/BUILD_ID`. |
| Preview deployment | OPEN | No Phase 2 evidence has been recorded. |
| material stress | OPEN | No Phase 2 evidence has been recorded. |
| mobile overlays | OPEN | No Phase 2 evidence has been recorded. |
| Workout decision | OPEN | No Phase 2 evidence has been recorded. |
| Cognitive regression | OPEN | No Phase 2 evidence has been recorded. |
| final diff check | OPEN | Baseline `git diff --check` completed with exit code 0; later release evidence must be recorded before this gate can pass. |

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
