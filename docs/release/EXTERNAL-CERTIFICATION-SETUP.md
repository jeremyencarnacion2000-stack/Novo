# Novo — External Certification Setup

This document is the exact setup contract for the pending Todoist, Google Calendar, and MCP certification. It contains names, routes, scopes, and test steps only. **Never paste credentials, access tokens, refresh tokens, or client secrets into this file or into chat.**

## Current safety state

- The current local `.env` was inspected read-only and resolved to Neon database `neondb` on branch `br-odd-water-aez68lzv` (the main branch).
- The isolated QA branch is `br-summer-mouse-aehv2pg` in project `shiny-firefly-37692190`.
- Because the local environment is still on main, no synthetic user, Twin, or test rows were created. Native longitudinal certification is therefore **blocked until the isolated branch connection is configured**.
- No provider credentials were used and no production cron or deployment was activated.

## Environment checklist

Set these values in the intended environment through its secret manager. Keep the names exact; values are deliberately omitted here.

### Required application/session values

```text
DATABASE_URL=<isolated Neon development branch connection string>
NEXTAUTH_SECRET=<environment secret>
NEXTAUTH_URL=<canonical origin for this environment>
```

For the QA run, `DATABASE_URL` must resolve to branch `br-summer-mouse-aehv2pg`. Verify the branch before any write. Do not reuse a production or main-branch URL.

## Todoist certification

### Variables

```text
TODOIST_CLIENT_ID
TODOIST_CLIENT_SECRET
TODOIST_REDIRECT_URI
```

`TODOIST_REDIRECT_URI` must exactly match the callback registered in the Todoist app console:

- Local development: `http://localhost:3000/api/integration/todoist/callback`
- Preview: `https://productivitynovo.vercel.app/api/integration/todoist/callback`

Use the actual origin being certified; do not register both values under one environment by accident.

### Flow and scopes

1. Start from Novo's Todoist connector, which calls `/api/integration/todoist/connect`.
2. Novo redirects to `https://todoist.com/oauth/authorize` with scope `data:read_write`.
3. Todoist returns to `/api/integration/todoist/callback`.
4. The callback exchanges the code at `https://todoist.com/oauth/access_token`.
5. Novo verifies provider identity at `https://api.todoist.com/api/v1/user` before persisting the connection.
6. Canonical task verification uses `https://api.todoist.com/api/v1/tasks/{taskId}`. Ambient reconciliation reads bounded task state from `https://api.todoist.com/rest/v2/tasks` and activity from `https://api.todoist.com/sync/v9/activity/get`.

### Human proof

- Use a dedicated Todoist test account and one clearly named test task.
- Complete the task in Todoist, without opening Novo.
- Run the server-side ambient runner and verify the existing Novo task, OutcomeEvent, CognitiveReplanRequest, baseline, cursor, and Activity state.
- Replay the runner and confirm idempotent convergence.

## Google Calendar certification

### Variables

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
NEXTAUTH_SECRET
NEXTAUTH_URL
```

Google sign-in's base scope is intentionally only:

```text
openid profile email
```

For the Calendar connector, request only this incremental scope:

```text
openid profile email https://www.googleapis.com/auth/calendar
```

### Redirect and routes

- Google OAuth callback: `/api/auth/callback/google`
- Local redirect: `http://localhost:3000/api/auth/callback/google`
- Preview redirect: `https://productivitynovo.vercel.app/api/auth/callback/google`
- Scope/status check: `GET /api/integration/calendar`
- User-authorized pull sync: `POST /api/integration/calendar` with `{ "action": "sync_from_google" }`
- Calendar webhook: `POST /api/webhooks/calendar`

The webhook is not an open unauthenticated endpoint. Google must send `x-goog-channel-token` in the format `<userId>.<hmac>`, where the HMAC is SHA-256 over `userId` using `NEXTAUTH_SECRET`. A `sync` resource-state notification is acknowledged without a data pull; subsequent notifications read the user's stored Google account, synchronize the current viewport, and trigger the same ambient Twin runtime.

### Human proof

- Use a dedicated Google test account and one synthetic event.
- Grant only Calendar access.
- Run the explicit connector sync first; then update the test event and exercise the webhook path if a safe public callback is available.
- Verify the event is owned by the same user, appears in Novo Calendar, and changes the Twin's context without creating a second memory store.

## MCP certification

### Endpoint

- Local: `http://localhost:3000/api/mcp`
- Preview: `https://productivitynovo.vercel.app/api/mcp`

Novo exposes Streamable HTTP MCP over `GET`, `POST`, and `DELETE`. The server requires a Bearer token and supports both device PATs and OAuth 2.1 + PKCE.

### Device token path (recommended for first certification)

1. In Novo Settings → MCP access, create a token for the dedicated test device.
2. Choose read-only (`tasks:read`) first. Grant task writes only for the explicit write-loop proof.
3. Copy the token once; Novo stores only a revocable hash.
4. Configure the client with:

```json
{
  "mcpServers": {
    "novo": {
      "url": "https://productivitynovo.vercel.app/api/mcp",
      "headers": { "Authorization": "Bearer <token-created-in-Novo>" }
    }
  }
}
```

For local certification, replace the URL with `http://localhost:3000/api/mcp`. Never commit or screenshot the token.

### OAuth discovery path

- Authorization server metadata: `/.well-known/oauth-authorization-server`
- Protected resource metadata: `/.well-known/oauth-protected-resource`
- Authorization: `/api/oauth/authorize`
- Token: `/api/oauth/token`
- Dynamic client registration: `/api/oauth/register`
- Revocation: `/api/oauth/revoke`
- JWKS: `/api/oauth/jwks`
- Consent UI: `/oauth/consent/{uid}`

OAuth clients must use PKCE. Refresh tokens are supported for clients that request the `refresh_token` grant.

### Available MCP surface

Read-oriented tools include `read_tasks`, `get_pending_tasks`, `read_objectives`, `read_recommendations`, and `read_routines`. Mutating tools include `create_task`, `complete_task`, `start_task`, `update_task`, `update_checklist_item`, and `record_recommendation_outcome`. `read_integration_data` and `trigger_plugin_sync` exercise integration state and provider sync.

The route currently checks a few tool-specific scopes (`goals:read`, `recommendations:read`, `recommendations:update`, `activity:write`) that are not listed in `lib/mcp/scopes.ts`. Treat that as a current certification observation: do not claim those scopes are available to a device PAT until the route and metadata are deliberately reconciled in a future, explicitly authorized change.

### No-browser proof

Use the test-only harness in `scripts/mcp-certification.mjs` against the endpoint. It performs only MCP initialization, `tools/list`, and an optional read-only `read_tasks` call. It never creates, updates, or completes data.

```powershell
$env:NOVO_MCP_ENDPOINT='https://productivitynovo.vercel.app/api/mcp'
$env:NOVO_MCP_TOKEN='<token-created-in-Novo>'
node scripts/mcp-certification.mjs
node scripts/mcp-certification.mjs --read-tasks
```

## Native longitudinal certification gate

Before any provider proof is called a product proof, configure the isolated Neon branch and use the normal authenticated UI with a clean synthetic QA account. Record the account and every created row for cleanup. The required sequence is:

1. Complete onboarding and ask Novo “What should I do now?”
2. Create and act on native tasks, focus, routines, and outcomes.
3. Repeat the same behavior enough times for the existing hypothesis/emerging-pattern thresholds to be reached.
4. Verify the pattern changes a later recommendation, not just a label.
5. Apply a correction and verify the before/after decision and persisted correction evidence.
6. Confirm Today, Chat, Cognitive, and Activity read from the same Twin.
7. Confirm a native event can produce a proactive, context-aware next step.

If the branch cannot be verified as isolated, stop before onboarding. Do not create a QA account and do not seed rows manually.

## Required inputs before certification

- Isolated Neon branch connection for `br-summer-mouse-aehv2pg`.
- Dedicated Todoist test client and test account, if external provider proof is desired.
- Dedicated Google OAuth client/test account, if Calendar proof is desired.
- A Novo-issued MCP PAT or an MCP client that supports the documented OAuth discovery/PKCE flow.

Credentials should be configured in the environment, not sent in chat or committed to the repository.

