# Novo — Development Closure Inventory

Date: 2026-08-13  
Scope: repository/runtime inventory before final development closure.  
Policy: no new provider or architecture is introduced by this document.

## Core backend surfaces

- Prisma/PostgreSQL persistence (`prisma/`, `lib/prisma*`)
- Next.js App Router API and server actions (`app/api/`)
- Cognitive Twin graph, signals, outcomes, plans and replan requests (`lib/cognitive*`)
- Todoist ambient reconciliation (`lib/cognitive-reconciliation/`)
- Google Calendar aggregation and cognitive signals (`lib/google.ts`, `lib/calendar-aggregator.ts`, `lib/plugins/gcal-plugin.ts`)
- MCP HTTP/OIDC/PAT server, scopes, audit and idempotent mutations (`app/api/mcp/`, `lib/mcp/`)
- Inngest-compatible signal processing (`lib/inngest/`, `lib/twin-signal.ts`)
- Auth/session and OAuth callbacks (`lib/auth.ts`, `app/api/auth/`, `app/api/integration/*/callback`)
- Billing checkout, portal, entitlements and webhooks (`app/api/billing/`, `app/api/webhooks/`)

## External provider matrix

| Provider / actor | Purpose | Auth | Current implementation | Local/contract proof | Real network status | Release class | Release blocking |
|---|---|---|---|---|---|---|---|
| Todoist | Human-originated task reality and ambient reconciliation | OAuth access token + provider identity | OAuth, identity verification, scoped mapping, baseline/cursor/claim adapter, `completeDurableTask()` | PASS: focused runner, no-browser, linking and OAuth tests | BLOCKED_EXTERNAL: no dedicated safe Todoist account/token available in this environment | RELEASE_CRITICAL | Yes |
| Google Calendar | Context source for scheduling/load signals | Google OAuth token refresh | OAuth scopes, event read/write, aggregation, plugin and cognitive signal path | PASS: calendar aggregator, connector and signal tests | BLOCKED_EXTERNAL: no dedicated synthetic Google Calendar account/credentials available | RELEASE_CRITICAL | Yes |
| MCP / Codex | Agent-originated reads/actions into Novo | Novo PAT or OIDC consent + scopes | Streamable HTTP MCP, request guard, ownership, scope checks, audit/idempotency and action reconciliation | PASS: auth, guard, scope, audit and provider-completion tests | BLOCKED_EXTERNAL: no independent MCP/Codex client session available for external proof | RELEASE_CRITICAL | Yes |
| Google Identity | Primary sign-in and OAuth identity | NextAuth Google OAuth | Sign-in, callback, session and ownership callbacks | PASS: auth import/config tests; authenticated Preview QA flow passed | PASS for Preview session/auth; real Google OAuth remains untested without a dedicated Google account | RELEASE_CRITICAL | No for Preview; real Google OAuth remains external |
| Stripe | Billing checkout, portal and subscription webhook | Stripe secret + signed webhook | Checkout, portal, status and signed webhook route | PASS: route/type coverage exists | SAFE_BLOCKED_EXTERNAL: no safe sandbox credentials/network proof in this run | PRODUCT | No if graceful |
| Lemon Squeezy | Billing checkout/webhook compatibility | Signed webhook secret | Webhook persistence/idempotency route and checkout support | PASS: Lemon Squeezy checkout test exists | SAFE_BLOCKED_EXTERNAL: no safe sandbox credentials/network proof in this run | PRODUCT | No if graceful |
| Notion | Imported tasks and behavioral signals | OAuth/provider token | OAuth callback, plugin sync, scoped task mapping | PASS_READ_ONLY: implementation and ownership paths covered | BLOCKED_EXTERNAL: no dedicated test workspace/token | OPTIONAL | No |
| Slack | Workspace/context sync | OAuth/provider token | Plugin sync and auth test path | PASS_READ_ONLY: implementation present | BLOCKED_EXTERNAL: no dedicated test workspace/token | OPTIONAL | No |
| GitHub | Repository activity context | OAuth/provider token | Plugin sync and ownership path | PASS_READ_ONLY: implementation present | BLOCKED_EXTERNAL: no dedicated test account/token | OPTIONAL | No |
| Google Drive/Gmail/People/Books/Fit/YouTube | Context and assistant tools | Google OAuth scopes | Existing `lib/google.ts` services and AI tools | PASS_READ_ONLY: code path/unit coverage where present | BLOCKED_EXTERNAL: no dedicated account and scope proof | OPTIONAL | No |
| Spotify | Music/context integration | NextAuth OAuth + refresh | Provider and token refresh path | PASS_READ_ONLY: auth import/redirect coverage | BLOCKED_EXTERNAL: no dedicated account/token | OPTIONAL | No |
| AI model APIs (Gemini, Groq, OpenRouter, xAI, Cerebras, DashScope, Chutes, OpenAI Whisper) | Planning, chat and voice support | Provider API keys | Existing server-only adapters | PASS: build/type boundaries; provider calls are isolated | BLOCKED_EXTERNAL unless a configured key is intentionally used | PRODUCT | No if fallback/error state is graceful |
| Resend/SMTP | Transactional email | Server API/SMTP credentials | Existing email utility | NOT_CERTIFIED: no safe mail delivery proof in this run | BLOCKED_EXTERNAL | OPTIONAL | No |
| Inngest | Background signal processing | Inngest event/signing keys | Compatible event/function integration | PASS: server boundary; no cron activation | BLOCKED_EXTERNAL when keys are absent | OPTIONAL | No |

## Webhooks, polling and jobs

- Todoist OAuth callback and server-side ambient runner; production cron remains disabled.
- Google Calendar webhook route exists; event polling/aggregation remains owner-scoped.
- Stripe and Lemon Squeezy signed webhook routes exist.
- MCP request lifecycle is synchronous and audited; replay is idempotent by client key.
- Inngest signal processor is present but external activation is not claimed in this closure.

## Security / ownership notes

- Provider lookups and mutations are owner-scoped in the critical paths.
- Todoist ambient code fails closed for missing provider identity, revoked/reauth/error/disconnected status and stale mappings.
- MCP uses explicit scopes, bearer/PAT/OIDC validation, consent destinations, audit records and mutation idempotency.
- No provider secret or token is included in this inventory.

## Closure interpretation

The repository has implementation and contract coverage for the critical triad. Real Todoist, Calendar, MCP client, billing sandbox and Preview auth proofs require external credentials or a corrected deployment configuration. Those are recorded as external gates rather than silently promoted from mocks to “real” passes.
