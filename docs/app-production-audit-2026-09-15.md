# Novo app — production audit (refreshed 2026-09-17)

## Scope

This audit covers the authenticated product surface, its API routes, integrations, MCP/device access, persistence, and runtime effects. The marketing landing is intentionally out of scope. Native shells should mount `/app` and use the web backend/auth redirects; they should not mount the landing.

## Corrections made

- Chat stream validation now rejects an empty request before creating an activity run, and a provider response without a readable body closes the run as failed instead of leaving it `running` forever.
- Activity retention cleanup is user-scoped; a chat request no longer deletes expired operational records belonging to other users.
- The chatbot has a ref-based in-flight guard, so rapid duplicate events cannot append two user messages or start two provider runs. FileReader failures no longer strand that guard.
- Device/MCP token issuance performs the active-token count and insert under one PostgreSQL advisory lock, preserving the ten-token limit under concurrent requests.
- Calendar webhooks fail closed when `NEXTAUTH_SECRET` is absent; the old known fallback secret was removed.
- Task checklist mirrors are reconciled under a per-task lock. Creates, idempotent replays, edits, status changes, and due-date changes converge on one row; stale rows are removed when a task leaves today.
- MCP task reads no longer return generated task checklist mirrors as a second copy. MCP task mutations now reconcile calendar/checklist mirrors and emit the task signal.
- Lenis pauses its animation frame loop while the document is hidden and resumes on return.
- Cognitive Twin offline snapshots are now namespaced by authenticated user, and boot/reset requests are generation- and session-guarded so a slow response cannot hydrate another account.
- Activity recovery stops its fallback interval before re-opening SSE and ignores late responses after unmount.
- Service-worker registration is idempotent across Strict Mode/HMR mounts instead of installing duplicate listeners and update timers.
- Offline mutation replay is serialized and pins dequeue operations to the queue namespace captured at flush start, so online events or account switches cannot double-send or remove another user’s queued work.
- Chat persistence retries the newest conversation snapshot after an in-flight save, preventing a fast final edit from being silently skipped.
- AI conversation creation now reconciles an idempotent replay with the latest local snapshot via a follow-up PUT; a lost POST response can no longer make the chat appear saved while dropping messages typed during the request.
- Settings hydration and writes are generation- and account-guarded; a slow response or queued write from one session cannot hydrate or overwrite another account.
- Focus timer profiles, sound settings, paused state, and chronotype are namespaced per authenticated user; legacy global keys are no longer read or written.
- Notification read/deleted markers and the in-memory notification cache are namespaced per account and reset on session changes.
- Activity sequence allocation and daily analytics read/merge/write operations run under per-user PostgreSQL advisory locks, preventing duplicate sequence numbers and lost concurrent increments.
- Checklist and goal completion analytics only fire on the incomplete → completed transition, so idempotent retries do not inflate completion metrics.
- Cognitive event tracking is best-effort and cannot turn a durable Twin/activity operation into a failed request when analytics storage is unavailable.
- Twin evolution cursors and refresh snapshots are account-scoped, preventing cross-account “already seen” state and stale local hydration.
- Chat conversations, model selection, Twin-mode preference, and the chatbot's in-memory async work are reset and guarded at the account boundary; late loads/saves are aborted or ignored after a session switch.
- Scheduled browser notifications and uploaded custom-model catalogs are scoped to the authenticated user and re-hydrated when the account changes.
- Local data backups and the settings “clear cache/delete workspace” actions no longer call a global `localStorage.clear()`; they remove only the current user's scoped client data.
- The DataIntegrator IndexedDB mutation queue now carries its owning user, drops legacy entries without an owner, and only replays the active account's pending operations when the authenticated app shell is mounted.
- Library book status writes now normalize legacy `completed`/`want-to-read` values to the canonical `read`/`to-read` vocabulary; the update endpoint validates input, keeps ownership in the Prisma filter, and returns a safe 404 for missing books.
- Library creation now serializes the short user/title/author lookup-and-create window with a PostgreSQL advisory lock, so concurrent catalog retries cannot create two identities when one payload includes ISBN metadata and the other does not; the existing owned-book and unique-index checks remain in place.
- Open Library search requests are abortable and generation-guarded, so a slow response from an older query cannot replace the results for the query currently on screen.
- The authenticated shell no longer wraps `PageWrapper` in a second pathname-keyed transition. `PageWrapper` remains the single route-motion owner, removing the compounded transform/opacity handoff that made page changes visibly re-layout after entering.
- The landing-only Outfit stylesheet is no longer requested on authenticated app routes; the app keeps its Inter stylesheet without paying for the marketing display font.
- Calendar event reads cancel the previous request when the month or source filters change, so a slow response cannot paint an older month over the current view; unmount also aborts the active request.
- Social message polling pauses while the document is hidden, aborts the previous friend request when selection changes, and uses an idempotency key for message sends.
- The global music player skips hidden-tab progress reads, avoiding one iframe query and React update per second while the app is backgrounded.
- The peak-task orchestrator no longer polls the legacy cognitive-patterns endpoint whose result was hard-coded to `none`; this removes a dead ten-minute request without changing the live task/evolution flows.
- School course and grade creation now preserve one client intent across retries, so a lost response cannot create a second record.
- Library adds now send a stable intent key per book payload while the request is retryable; the existing identity guard remains the final duplicate defense.
- Device presence sessions sent through `sendBeacon` now carry an intent key and use the same server replay boundary as other creates.
- Music history now has one persistence owner (the global player); the Music page no longer posts the same play a second time. Track loading uses a stable idempotency key, and playlist creation disables duplicate submits while a retryable request is in flight.
- Tracker success toasts now fire only after the optimistic mutation is confirmed; failed creates/edits/deletes/entries no longer announce a success that will be rolled back.
- Removed three unreferenced legacy app artifacts: the unused Pomodoro hook, the standalone music autoplay engine (which created audio/listener state outside React), and the orphaned focus-mode CSS. The live Focus/Music surfaces remain unchanged.
- The voice orb's audio-reactive RAF now runs only while recording and only while the document is visible; billing status polling ignores late responses after unmount. This removes idle animation work and post-navigation state writes without changing the active UI.
- Connector status/catalog requests now abort on unmount or account change and clear immediately on sign-out, so a previous user's badges cannot flash into the next session.
- Library loading aborts on unmount and ignores stale responses; invalid/non-array payloads no longer overwrite the view with an unexpected shape.
- Social search aborts stale queries, friend refreshes are session-bound, and message retries reuse one intent key so a lost response cannot create a duplicate message.
- Novo Loop outcome and Google Calendar actions now retain one intent key through retry; Drive workspace backups do the same, preventing duplicate outcome events, focus blocks, or backup files after a lost response.
- Notes and School initial loads now abort on unmount and reject malformed payloads, preventing stale data and loading-state updates after navigation.
- Voice scheduling now returns a real error when the checklist write fails, keeps its idempotency key for a retry, and no longer forwards raw API errors to the model; the mobile-safe idempotency fallback is used in embedded webviews too.
- The ambient Peak Focus orchestrator validates task/plan payloads, avoids hidden-tab evolution polling, aborts stale decision requests, and clears its unlock timer on unmount.
- The dashboard's Now context loader cancels superseded requests, pauses while hidden, validates list payloads, and avoids stale loading-state writes after navigation.
- Checklist aggregation no longer shows a task twice when its canonical Task has a same-day linked Checklist mirror; rapid add/toggle actions are guarded while their mutation is in flight.
- The authenticated Today surface now aborts superseded/hidden-tab loads, validates task payloads, refreshes when the user returns, and ignores stale loading writes; rapid completion taps are serialized per task so an external Notion/Todoist update is not sent twice.
- Quick Capture now uses the shared embedded-webview-safe idempotency key, aborts project/note loads when the modal closes or unmounts, and ignores stale loading responses.
- Chat confirmation and auto-execution actions now carry durable idempotency keys and a ref guard against double pointer events; chat streams, attachment parsing, and formatting follow-ups are aborted/ignored across account changes. Browser logs no longer print structured private model output or raw request errors.
- The authenticated route transition now has one owner: `PageWrapper` uses a short, low-displacement handoff instead of a full-viewport slide, and the duplicate `app/template.tsx` transform was removed. This prevents fixed dialogs and floating surfaces from being re-laid out after navigation; the in-app `showAnimations` setting now reaches the route owner.
- Hidden-tab polling now stops its timers instead of waking every interval in Now context, ambient context, cognitive agent/inference status, and the music progress synchronizer. Each loop resumes on visibility and cleans up its listener/controller on unmount.
- The app-owned animation preference now disables CSS transitions, loops, and smooth scrolling through `data-animations="false"`, independently of the operating-system reduced-motion preference.
- The settings material effect now depends on `showAnimations` as well as the visual controls, so toggling animations immediately updates the root contract used by CSS, Lenis, and Framer Motion instead of waiting for another appearance change.
- The cognitive brain-map WebGL loop now pauses on document visibility changes as well as intersection changes; social messages, Twin evolution, and service-worker update checks stop their timers while the app is backgrounded and resume on return.
- Framer Motion now reads the same authenticated `showAnimations` preference as CSS and Lenis; turning motion off no longer leaves route, overlay, or button transforms running. Shared buttons also stop reserving a permanent GPU layer through `will-change`, reducing compositor memory pressure and intermittent shadow seams.
- Premium glass cards no longer reserve a permanent compositor layer; modal and route motion add transient GPU hints only while animating, reducing shadow flicker and memory pressure on desktop.
- Connector badges now use capability-level Google status (`gmail`, `calendar`, and `drive`) instead of treating a basic Google identity grant as access to every Google product; the connector modal no longer hides required consent buttons after sign-in.
- Daily browser reminders now keep one cancellable timer; changing reminder settings, signing out, or switching accounts cannot leave a recursive timer from the previous session alive.
- Calendar contact search now aborts the previous request and verifies the active query before painting results, eliminating stale contacts after fast typing or navigation.
- Cognitive biometrics polling is account-bound and abortable; a late Google Fit response cannot write stress data into the next account, and hidden-tab polling does not retain an in-flight request after teardown.
- Select and paywall shared-element transitions cancel pending animation frames when their trigger closes or unmounts, preventing stale modal flips after rapid interaction.
- Business client/content/deal forms now reuse an idempotency key for the same payload and deduplicate replayed rows in local state; changing a failed form creates a fresh intent instead of reusing a conflicting key.
- Music follow/like actions now validate their action and payload contracts before Prisma; an unknown follow action can no longer be interpreted as an unfollow, and incomplete likes return a clear 400.
- Music follow/like controls now serialize one optimistic transition per artist/track, disable the control while it is in flight, and roll back the local state on a failed response instead of leaving a duplicate or stale visual item.
- Experiment check-ins now enforce integer 1–5 scores and bounded notes before persistence.
- Business deal create/update boundaries now reject invalid numeric values and malformed close dates before Prisma, avoiding invalid-date 500s from the pipeline.
- Protected client-side navigations now keep the app's compact loading surface while an expired session redirects to sign-in; they no longer flash the acquisition carousel inside an authenticated route.
- Google Analytics on the app shell is deferred with `lazyOnload`, keeping the first login/product render independent of the third-party analytics bundle.
- Cognitive Twin boot/freshness reads now select only the current profile fields; evolution logs and snapshots stay on their dedicated analytics paths instead of adding dozens of rows to every 15-second fallback refresh.
- Context Hub GPU promotion is now transient: the active morph states receive a compositor hint, while the idle capsule is painted normally to reduce desktop shadow seams and idle GPU memory pressure.
- Friend-request creation now treats an exact same-direction retry as a replay (including the concurrent unique-constraint race), while a reverse-direction invitation remains a distinct action that must be accepted explicitly.
- Friend-request creation rejects self invitations before touching storage, keeping the social graph free of self-referential rows.
- Social Discover now disables an invitation button for the lifetime of its request (with a ref guard against same-tick double clicks), so the UI cannot launch competing friend calls while the server resolves the first one.
- The floating music reward effect now owns and cancels its timers; repeated habit completions restart one visual reward instead of stacking state updates, and navigation cannot leave timers writing after unmount.
- Side-sheet surfaces now own an internal, overscroll-contained scroll boundary so long mobile forms keep their actions reachable instead of extending past the viewport.
- Onboarding staged reveals now own and cancel their timers and analysis/Day 1-plan requests on unmount; answer taps are serialized so navigation cannot trigger late state writes or create the initial plan twice.
- Removed the unused internal-AI `create_note` handler that returned a random fake ID without persisting a note; note creation remains on the authenticated, idempotent `/api/notes` route.
- Removed the synthetic `Review [course]` checklist projection that could never persist completion and reappeared on refresh; academic work is now sourced only from real assignment/grade signals.
- Provider fallbacks, routine parsing, internal AI events and offline replay logs no longer include private prompts, documents, error bodies, cookies, bearer credentials or API keys.
- Focus sessions now allocate a fresh idempotency key at every start boundary (including automatic break/work cycles), so a stopped session cannot make the next session look like a conflicting replay.
- Novo Loop recommendation transitions are serialized by a per-recommendation provider lock; concurrent accepts can create at most one task and later replays return a safe conflict. A focused regression covers the race boundary.
- Focus profile creation is guarded against same-tick double taps and normalizes invalid/empty numeric inputs to bounded values before persistence; notification and audio APIs are optional and cannot interrupt session completion when a browser denies permission or autoplay.
- Browser notifications are defensive across permission revocation, blocked constructors, service-worker failures and negative delays; notification delivery remains best-effort and cannot break the durable Focus/session flow.
- OAuth access/refresh tokens are no longer copied into the browser session. Google and YouTube reads resolve the authenticated user's persisted grant server-side with capability-specific scopes, so credentials stay out of client payloads and non-Google login sessions do not break provider reads.
- Password recovery is a real, bounded flow: the forgot endpoint is anti-enumeration and rate-limited, reset tokens are stored only as hashes with one-hour expiry and single use, successful resets invalidate all active sessions, and Settings “Change Password” links to the same flow.
- Calendar webhooks no longer log event titles or account identifiers, and
  provider event deletes/upserts are explicitly checked against the current
  user's ownership before the local mirror is changed.
- Chat actions that start or finish a workout, and actions that add a grade,
  now use the durable intent boundary too. Retries replay the owned workout
  log/grade instead of creating duplicate child exercise rows or grade rows.
- Auth password visibility controls now expose an accessible label, pressed state,
  and tooltip in both sign-in and sign-up flows.
- Ambient planning, Todoist reconciliation and AI call logging persist only stable
  operational codes; provider diagnostics remain server-side and are not exposed
  through the ambient state endpoint.
- Day-plan task children use a stable positional fingerprint, so model wording
  changes during a retry replay the original task instead of duplicating it.
- Routine parsing is bounded at 40.000 characters before provider calls, keeping
  large imports from consuming unbounded memory or provider quota. Routine
  completion history also bounds the period to one year and rejects a
  routine selector outside the authenticated user's own routines.
- Added and applied the additive `20260917150000_add_activity_query_indexes`
  migration. Routine days/exercises, workout logs, routine history and tracker
  entries now have composite foreign-key/date/order indexes for their hot reads.
- Calendar event reads now reject invalid/reversed or oversized date ranges;
  source filters are normalized and event titles/descriptions are bounded before
  any provider or database work.
- Cognitive Dress Code now cancels stale requests, validates provider metrics and
  renders a retry state instead of leaking `undefined` values or raw client
  errors when context is unavailable.

## Verification

- `npm test -- --runInBand`: **216 suites, 733 tests, 2 snapshots passed** (full suite rerun after the password-recovery, server-only OAuth, Calendar webhook privacy/ownership, AI workout/grade/day-plan idempotency, bounded routine parsing, animation-preference, cognitive-route auth boundary, Google/YouTube Music session boundaries, Analytics `UserSession` intent replay and bounded history windows, Google Calendar auth boundary, contextual dialog viewport clamping, bounded provider search inputs, routine-history ownership/window, calendar-range validation, Cognitive Dress Code retry state, Twin Agent log-hygiene, private error-boundary and OAuth callback log-hygiene changes; auth tests cover anti-enumeration, hashed single-use reset tokens, atomic concurrent replay handling, session invalidation and credential stripping) covering the app-only lifecycle, motion-preference, connector-capability, conversation-replay, Twin-refresh, music interaction guard, mutation-boundary and private-log-hygiene patches.
- `npm run lint`: **0 errors**; two pre-existing Next font warnings in `app/layout.tsx`.
- TypeScript no-emit check: passed.
- `npm run build`: passed; Next.js generated all 133 app/API routes, including the password recovery page and endpoints.
- `npx prisma migrate status`: all 36 migrations are applied in the production
  database, including the activity query indexes.
- Focused post-patch overlay regression: **13 tests passed**, covering mobile/desktop suppression and the music widget's presence across overlay states; timer cancellation is covered by the component cleanup implementation and build/type checks.
- `npm run build:cap`: passed; the server-backed app-only native build generated all 133 routes.
- The Google Calendar create route now rejects incomplete sessions before any
  provider call, and contextual dialog placement is clamped to the visual
  viewport rather than hard-coded offsets.
- Targeted regression tests cover chat run lifecycle, task idempotency, checklist reconciliation, provider-lock behavior, MCP token primitives, voice teardown, and Peak Focus orchestration.
- New targeted regressions cover SSE recovery cleanup, serialized offline queue flushing, account-bound DataIntegrator replay, settings/session isolation for chat and Focus, notification scheduling, account-scoped model storage, school course/grade replay behavior, AI conversation create/replay convergence, deal update validation, experiment check-in validation, and music action validation.

## Remaining release gates

These are environment or product gates, not silently “fixed” in source:

1. Authenticated production E2E is still required for `/app`, `/chat`, task/checklist edits, each connector callback, and mobile viewport behavior. The Codex browser could not import the existing Chrome session because Windows DPAPI denied cookie decryption.
2. Lemon Squeezy Live checkout/webhook configuration must be verified in the merchant account; source tests cannot prove live variant IDs, signing secret, or receipt-to-plan propagation.
3. Android/iOS native builds need a real device/simulator pass for system-browser OAuth return, deep-link handoff, offline queue replay, microphone permissions, and safe-area layout.
4. Connector freshness and provider rate limits need a canary run with the user’s real Google, Slack, Todoist, Notion, and GitHub accounts.

Until those gates are exercised, the app is source-verified and regression-tested, but should not be described as fully certified for every external provider or native device.

## Deployment canary

- Vercel production deployment: `dpl_FiCHpY2D1HVQkFMt7QfK4sPtDW6V` (`novo-desktop-a85mnwo7b.vercel.app`), **READY**; the production alias is `https://productivitynovo.vercel.app`.
- The production alias was explicitly reassigned after the Calendar webhook privacy/ownership, password-recovery atomic replay and CPU-guard, OAuth capability-boundary, Novo Loop, AI workout/grade/day-plan idempotency, bounded routine parsing, animation-preference, cognitive-route auth boundary, Google/YouTube Music session boundaries, accessibility, log-hygiene, dead-hook cleanup, music-route log cleanup, Analytics compositor cleanup, Analytics `UserSession` replay and bounded history windows, Google Calendar auth-boundary, bounded provider-search, routine-history ownership/window, recommendation-limit, activity-index, calendar-range-validation, cognitive-state retry, analytics-log-hygiene, internal-AI stable-error, Animate UI microinteraction and ripple robustness fixes and now resolves to `dpl_FiCHpY2D1HVQkFMt7QfK4sPtDW6V` (`novo-desktop-a85mnwo7b.vercel.app`).
- Unauthenticated app routes `/app`, `/chat`, `/connectors`, `/today`, `/routines`, and `/settings/mcp` all return the expected `307` redirect to `/auth/signin` with their callback path preserved.
- `/app` loads the sign-in surface without console errors after the redeploy; the preview deployment may log expected unauthenticated 401s from session probes.
- Protected integration endpoints return `401` JSON without a session, rather than leaking data or rendering an error page.
- `/api/books` and `/api/integration/status` both return the expected `401` JSON without a session.
- The final canary on `dpl_FiCHpY2D1HVQkFMt7QfK4sPtDW6V` returned the expected sign-in redirect for `/app`; `/api/books` remains `401 {"error":"Unauthorized"}` without a session. Protected client navigation now shows the compact app loader during the redirect instead of flashing the acquisition carousel.
- The production sign-in surface was checked at mobile (375×812), tablet (768×1024), and desktop (1280×720); the editorial panel collapses cleanly on mobile, the form remains usable, and no console errors were reported.

## Cleanup check

## Production performance sample (app-only)

The unauthenticated `/app` resolver was measured on the production alias after
the latest deployment with the gstack browser: a warm 1440×900 reload completed
the navigation in **~322 ms** (TTFB **~58 ms**) and the mobile 390×844 warm sample in
**~211 ms** (TTFB **~50 ms**), with no console errors. A fresh desktop process
measured ~1,548 ms because of browser startup/cache variance; the warm request
path remained below the unauthenticated entry budget.
It redirected to
`/auth/signin?callbackUrl=%2Fapp` with no console errors. This is a cold
unauthenticated boundary check; it does not claim the same timings for an
authenticated session, provider callbacks, or native WebViews, which remain
release-gate tests requiring real accounts and devices.

Dependency scan found no safe unused package to remove. Its five “unused” reports are build/native references (`@capacitor/*`, `@heroui/styles`, `@tailwindcss/postcss`, and `jest-environment-jsdom`), so deleting them would break the app or native build. The remaining legacy live-orb module is retained because tests and the mobile overlay policy still exercise its contract.

`npm audit --omit=dev` is clean for the production dependency graph. The full audit still reports three vulnerabilities in transitive development/build tooling (`@babel/core`, `js-yaml`, and `tar`); they are not shipped in the server runtime, but should be upgraded in a dedicated dependency-maintenance change rather than applying an unreviewed lockfile-wide fix during this app release.
