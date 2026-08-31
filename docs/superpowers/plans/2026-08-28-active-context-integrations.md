# Active Context Integrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make authorized integrations continuously contribute privacy-minimal context to the Twin, expose GitHub as a real OAuth connector, and keep recommendations grounded in fresh source health and durable signals.

**Architecture:** Keep provider clients responsible for external APIs, the plugin orchestrator responsible for bounded parallel sync, and the cognitive runtime responsible for interpretation/replanning. Add GitHub OAuth using the existing signed, persisted integration-state primitive and store only provider identity plus encrypted-at-rest platform token fields already used by IntegrationAccount. Extend the durable ledger with freshness/health metadata without persisting private message bodies.

**Tech Stack:** Next.js App Router route handlers, NextAuth session guard, Prisma/PostgreSQL, GitHub REST API, existing `novoSignalLedger`, `ambient-context-refresh`, Jest.

**Spec:** User request: active Gmail/connected-source context, proactive recommendations/adaptation, GitHub integration, and production-ready connector flow.

## Global Constraints

- Every mutable API input is validated with Zod or an equivalent explicit guard.
- Every database query for a user-owned resource includes the authenticated `userId`.
- Gmail sync stores aggregates and safe metadata only; message bodies and raw private text are never written to the ledger or logs.
- External writes remain explicit, idempotent, auditable, and confirmation-gated.
- Refresh remains bounded by the existing persisted claim and provider timeout; no production cron activation is added in this change.
- Do not alter existing users, migrate destructively, or change global Neon configuration.

### Task 1: Contract tests for active context and GitHub OAuth

**Files:**
- Create: `lib/plugins/__tests__/github-oauth-state.test.ts`
- Create: `lib/plugins/__tests__/active-context-contract.test.ts`
- Modify: `lib/todoist-oauth-state.ts`

**Interfaces:**
- `IntegrationOAuthProvider` includes `github`.
- `syncAllPlugins` reports connected GitHub and runs the provider through the same bounded path as other sources.
- GitHub OAuth state accepts only signed, unexpired `github` payloads.

- [ ] Write failing tests for GitHub state round-trip/rejection, for a connected GitHub account being selected, and for an active refresh returning provider summaries without private content.
- [ ] Run the focused Jest files and confirm they fail because the GitHub provider/state contract is absent.
- [ ] Implement only the smallest provider-type/state changes needed for the tests.
- [ ] Re-run the focused tests and confirm green.

### Task 2: GitHub OAuth connector and durable account status

**Files:**
- Create: `app/api/integration/github/connect/route.ts`
- Create: `app/api/integration/github/callback/route.ts`
- Create: `app/api/integration/github/route.ts`
- Create: `lib/github-provider-identity.ts`
- Modify: `lib/todoist-oauth-state.ts`

**Interfaces:**
- `GET /api/integration/github/connect` requires a session and redirects to GitHub with `read:user repo` and a signed state.
- `GET /api/integration/github/callback` validates cookie, persisted nonce, session ownership, code exchange, and provider identity before upserting `IntegrationAccount(provider='github')`.
- `GET /api/integration/github` returns `{connected, login, repoCount, lastSyncedAt, syncStatus}` without tokens.
- `POST /api/integration/github?action=sync` uses the existing `syncPlugin` and `runAmbientTwinForUser` path.
- `DELETE /api/integration/github` removes only the authenticated user’s GitHub account.

- [ ] Add failing route/helper tests for missing OAuth configuration, invalid state, token exchange failure, cross-user state rejection, and token-free status responses.
- [ ] Run tests to verify the expected failures.
- [ ] Implement secure state/callback/account persistence following the existing Todoist/Slack pattern; never log tokens or provider payloads.
- [ ] Run the route/helper tests and existing integration tests.

### Task 3: GitHub provider quality and active signal provenance

**Files:**
- Modify: `lib/plugins/github-plugin.ts`
- Modify: `lib/plugins/plugin-orchestrator.ts`
- Modify: `lib/ai/context-builder.ts`
- Modify: `lib/cognitive/canonical-planner.ts`
- Modify: `lib/ai/source-attribution.ts`

**Interfaces:**
- GitHub sync reads the durable IntegrationAccount token, uses the authenticated login/id rather than requiring a public email, bounds repositories/commits, and emits aggregate signals only.
- Provider summaries expose `lastObservedAt`/`sourceFreshness` but never raw external content.
- Context includes only active, non-excluded provider signals and source health; recommendations cite fresh signal provenance.

- [ ] Add failing tests for a private GitHub email/null response still attributing commits to the authenticated login, stale signals being marked stale rather than treated as current, and provider facts remaining privacy-minimal.
- [ ] Run focused tests and confirm red.
- [ ] Implement the bounded, login-safe GitHub reader and freshness-aware context projection.
- [ ] Run focused plugin/context/planner suites and confirm green.

### Task 4: Make the active loop visibly useful and resilient

**Files:**
- Modify: `lib/cognitive/ambient-context-refresh.ts`
- Modify: `app/api/plugins/sync-all/route.ts`
- Modify: `app/api/plugins/[provider]/sync/route.ts`
- Modify: `components/connectors/connectors-client.tsx`

**Interfaces:**
- Manual and background refresh share the same bounded orchestrator and return per-provider status, signal count, and planning state.
- Connector UI presents GitHub as connected/available and shows the last sync plus what the Twin learns.
- A provider failure leaves other sources and the Twin state intact; no false “adapted” status is shown.

- [ ] Add failing tests for partial provider failure preserving successful signals and for GitHub UI status/control wiring.
- [ ] Run focused tests and confirm red.
- [ ] Implement resilient response/status wiring and connector UI changes.
- [ ] Run component/API tests and confirm green.

### Task 5: Production-readiness validation

**Files:**
- Modify: `docs/integrations.md` (create if missing)
- Modify: `.env.example` (only if present and additive)

- [ ] Document required GitHub/Gmail/Google variables, exact callback URLs, least-privilege scopes, refresh cadence, privacy boundaries, and explicit confirmation requirements for writes.
- [ ] Run `npm test -- --runInBand`, targeted lint/type checks, `prisma validate`, `prisma generate`, and `git diff --check`.
- [ ] Run a no-browser route-contract test with mocked provider HTTP and verify durable ledger/planner outputs.
- [ ] Deploy only after all checks pass; verify `/connectors`, GitHub status, and sync endpoint in Preview. Keep production cron disabled until external credentials are verified.

