# Handoff — Novo session (2026-07-11)

## Project

**Novo** — a "Cognitive Operating System," not a productivity app. Core thesis: a
"Cognitive Twin" continuously models the user's attention/energy/habits/workload
from real behavioral signals and answers "what should this person do right now?"
Next.js 16 (App Router), Prisma/Postgres (Neon), NextAuth, Tailwind v4, deployed to
Vercel at **https://productivitynovo.vercel.app**.

**Why this matters right now:** Novo is competing in the "Build with Gemini
XPRIZE" hackathon (Category 1, Education & Human Potential, $2M pool, **deadline
Aug 17 2026**), judged on real revenue + "AI-Native Ops" (does the AI visibly/
provably execute real decisions autonomously). The $500k prize funds scaling
Novo *and* the user's other businesses. (Full context lives in the auto-memory
system — `project-xprize-hackathon.md`, `project-xprize-priorities.md`,
`project-hackathon-stakes-succession.md`, `novo-product-philosophy.md`.)

## State right now (2026-07-11)

**Deployed to production**, verified after every change this session via
`npx vercel deploy --prod --yes` + `npx vercel alias set <deployment-url>
productivitynovo.vercel.app` (the custom domain does not auto-follow a new
prod deploy — this manual alias step is required every time). Build/type-check
workflow used this session: `NODE_OPTIONS="--max-old-space-size=8192" npx tsc
--noEmit` (authoritative type-check — `next.config.mjs` has
`typescript.ignoreBuildErrors: true`, so a passing `next build` never means
type-safe), then `npm run build`, then deploy+alias+curl-verify.

Monetization (Stripe), the Cognitive Twin's real-time learning loop, and a
batch of real bugs (auth, service worker, animation craft, a fake metric) all
shipped this session — see below.

## What shipped this session (chronological, most recent first)

### Cognitive panel — real-data pieces of the target mockup
The user shared a target mockup for `/cognitive` (Cognitive Twin dashboard,
grid of stat cards + graph + sidebar nav) plus reference videos on mobile UI,
"vibecoded → professional" redesign principles, and dashboard design. Decision
made explicit with the user: **only build pieces backed by real data** —
Archetype/Focus Style/Learning Style and invented insight percentages ("42%
better at night") from the mockup were explicitly rejected as fabrication and
skipped.

Shipped, all reading real Prisma-backed data:
- `app/api/cognitive/metrics-history/route.ts` (**new**) +
  `components/cognitive/cognitive-metrics-strip.tsx` (**new**) — "Cognitive
  Metrics · Tendencia" strip: 3 cards (Cognitive Load, Recovery Reserve, Twin
  Confidence), each showing the current value plus a hand-rolled SVG
  sparkline of the real last-30-days `TwinSnapshot` history. Honest empty
  state ("Construyendo historial — usa Novo unos días") when a new user has
  no snapshots yet, instead of a fabricated line.
- `components/cognitive/active-modules-strip.tsx` (**new**) — reuses
  `useCognitiveTwin().twin.workspaceLayout.enabledModules` (the same real
  state Settings → Modules already toggles) against the shared `ALL_MODULES`
  catalog — no new endpoint needed.
- `components/cognitive/integrated-systems-strip.tsx` (**new**) — real
  connection status for Google (session), Notion + Drive (existing
  `/api/integration/notion` / `/api/integration/drive`), Stripe/Pro (existing
  `/api/billing/status`). Deliberately does **not** show GitHub/Gmail like the
  mockup did — this app doesn't integrate with either, so they'd be fake rows.
- `app/cognitive/page.tsx` — both strips + the metrics strip wired in as new
  rows between the existing Command Grid and the Cognitive Graph/Bitácora row.
- **Deferred, not started:** the 3D graph upgrade and a deep visual redesign
  of the landing page — both explicitly held back for a session with visual
  verification (screenshots/live browser), since blind visual-heavy changes
  carry real regression risk here (a prior 3D/fiber attempt broke the app via
  a React-reconciler singleton conflict, documented in code comments).
- **Library decision** (see auto-memory `feedback-animation-library-stack.md`):
  Barba.js / Anime.js / Spline rejected as redundant with the existing
  Framer Motion + GSAP Flip + vanilla-three.js stack or architecturally wrong
  fit. **Lenis is already installed and has a working
  `components/smooth-scroll-provider.tsx`**, proven in production on the
  authenticated sidebar — but wiring it into the public landing page was
  explicitly deferred: the landing's nav (`FloatingNav`) is `position: sticky`
  and is currently the first child of the scroll container, exactly where
  Lenis's content-transform would need to wrap — and Lenis's transform is
  documented to break `sticky` descendants. Fixing it correctly means moving
  the nav from `sticky` to `fixed` (real structural surgery, not a drop-in),
  which needs visual verification this session didn't have. User chose to
  wait rather than risk the site's most visible element blind.

### Animation craft review (emilkowalski/skills, `review-animations`)
User installed the skill collection via `npx skills@latest add
emilkowalski/skills` — lands in **`~/.agents/skills/`**, not
`~/.claude/skills/` (worth remembering if a skill "installed" but doesn't
show up where expected). Ran the `review-animations` skill's structured
review (10 non-negotiable standards, required Before/After table + tiered
verdict format) against the app's motion code. Six real findings, all fixed:

- `components/ai/modern-chatbot/welcome-hero.tsx` — voice-waveform bars
  animated `height` in an infinite Framer Motion loop (5 elements ×
  `repeat: Infinity`) — non-GPU, runs for the whole voice session. Switched to
  `scaleY` (GPU-only, same visual). Also gated behind `useReducedMotion()` —
  freezes to a static scale under `prefers-reduced-motion` instead of the
  continuous pulse (the systemic finding: the app's `prefers-reduced-motion`
  CSS only covered `.liquid-glass*` utility classes, not the Framer Motion
  surface — fixing every instance app-wide was judged disproportionate, so
  only the two genuinely continuous/infinite-loop animations found were
  gated, not one-shot fades).
- `components/cognitive/burnout-risk-meter.tsx` — fill bar animated `width`,
  tip marker animated `left` (both layout-triggering). Switched to
  `scaleX`/`translateX`. **Self-caught bug while fixing this**: Framer
  Motion's `x`/`y` props write their own inline `transform`, which silently
  clobbers a Tailwind `-translate-y-1/2` class on the same element (both
  target the same CSS property, inline wins) — the marker's vertical
  centering broke until moved into Framer's own `y: '-50%'`.
- `components/notification-center.tsx` — badge animated in/out from
  `scale(0)` (looks like it appears from nothing). Changed to `scale(0.9)`.
- Two `transition-all` instances (a button in `welcome-hero.tsx`, the base
  toast variant in `components/ui/toast.tsx`) scoped to the actual properties
  that change (`transition-[background-color,transform]` /
  `transition-[transform,opacity]`).

### Chatbot: three real bugs found and fixed
- **Rate limits / "no responde"**: not a code bug — live-tested all 3 AI
  providers. Groq: intermittently throttled (free tier, explains the user's
  history of rotating Groq accounts — a losing strategy against ToS and
  usage caps). Gemini: quota exhausted (shared across chatbot + cognitive
  engine + orb). **OpenRouter: `401 Missing Authentication header`** — the
  key is empty in Vercel, the same "Sensitive" env var bug hit earlier this
  project with `NEXTAUTH_URL`/`GEMINI_API_KEY`/`GROQ_API_KEY` (the Vercel CLI
  silently persists an empty value for env vars added as "Sensitive"; fix is
  `vercel env add ... --no-sensitive --yes`). Still needs a real OpenRouter
  key from the user. **Fix shipped**: added Gemini direct (via Google's
  OpenAI-compatible endpoint, so the same SSE streaming code path works
  unchanged) as a new rescue tier in `app/api/ai/stream/route.ts`, ahead of
  the OpenRouter tier — an independent quota pool from Groq.
- **The Twin never actually learned in production** — the real root cause
  behind "no se nota una IA adaptativa real." `lib/twin-signal.ts`'s
  `emitTwinSignal()` sent every behavioral signal (task completed, focus
  session, routine) to Inngest Cloud via `inngest.send()` — but
  `INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY` were never configured in Vercel,
  so every signal silently vanished (the send is wrapped in a swallowed
  try/catch by design, "best-effort"). `TwinEvolutionLog` was empty, the
  Bitácora was empty, confidence never grew — the whole cognitive engine was
  running on zero real learning signal. **Fix**: extracted the Inngest
  function's handler (`lib/inngest/functions/process-twin-signal.ts`) into a
  standalone `processTwinSignalHandler`, callable with a minimal inline
  `step.run` shim; `emitTwinSignal` now runs it directly via Next's `after()`
  (executes post-response, Vercel-safe, no queue dependency) instead of
  enqueueing to a queue that was never draining. The Inngest registration
  (`processTwinSignal = inngest.createFunction(...)`) is kept for if
  `INNGEST_*` keys ever get configured for real durable retries.
- **"Two chatbot panels" feel inconsistent** — user's own discovery, turned
  out to be a real bug, not a design question. `components/ai/modern-chatbot/
  chatbot-sidebar.tsx` (the compact panel that "opens normally") passed
  `onCopy={() => {}}` / `onRetry={() => {}}` / `onLike={() => {}}` /
  `onDislike={() => {}}` no-ops to every `<Message>` — and `message.tsx`'s
  internal handlers only run their real logic (`navigator.clipboard
  .writeText`, `retryMessage()`, `likeMessage()`, `dislikeMessage()`) when NO
  callback prop is passed. So copy/retry/like/dislike were silently inert in
  the sidebar, while fully working on the `/ai` full-page surface (which
  omits those props). Fixed by removing the no-op props — both surfaces now
  hit the same default logic. (The mobile fullscreen sheet already reused the
  shared `ModernChatbot` component, so it was never affected.)

### Auth / service worker — two real production bugs
- **Login-then-bounce-to-/landing race**: `app/client-layout.tsx`'s
  `AuthWrapper` redirected to `/landing` on the very first
  `status === 'unauthenticated'` tick from `useSession()`, with no grace
  period — a cold mount right after an external redirect (Google OAuth,
  Stripe Checkout's `success_url`) can report unauthenticated for one tick
  before the session cookie's fetch actually resolves. Fixed with an 800ms
  `setTimeout` before the redirect fires, cleared if the status flips to
  authenticated/loading first.
- **Reload → logged out** (root cause found *after* the above fix didn't
  fully resolve the user's report): `public/sw.js`'s fetch handler excluded
  `/api/auth/*` from its *API* cache branch, but that path still fell through
  to the final `else` branch, which is **cache-first** — so
  `/api/auth/session` responses got cached and served stale (often
  logged-out) on every reload, regardless of the real cookie. Clearing
  browser cache "fixed" it by accident (purged the poisoned entry). Fixed
  with an early `return` (no `respondWith`, straight to network) for
  `/api/auth/*` and RSC/data-navigation requests, plus bumping
  `CACHE_NAME`/`API_CACHE_NAME` from `v3` to `v4` to purge the already-cached
  bad entries for existing users.
- **Landing page inherited the user's in-app accent color** — `--primary` is
  written to `:root` globally by `lib/settings-context.tsx` from the user's
  personal theme accent (e.g. orange), and the landing page's `text-primary`/
  `bg-primary` classes picked that up instead of Novo's brand indigo. Fixed
  by pinning `--primary`/`--primary-rgb`/`--primary-glow`/`--ring` to the
  brand indigo (`#6366f1`) directly on the landing's root container, so it's
  never inherited regardless of the signed-in user's personal settings.

### Fake metric found and fixed
User asked explicitly to hunt down fake/mocked metrics across the app.
Checked business analytics, school analytics, productivity stats, the
cognitive engine's circadian model, and the Twin demo-seed endpoint (properly
gated behind an explicit `?demo=twin` URL param, not reachable by accident) —
all genuinely computed from Prisma. One real bug found:
`app/api/profile/route.ts` had `memberSince = new Date()` and
`daysSinceMember = 0` **hardcoded**, always, because the `User` model never
had a `createdAt` field. Added `createdAt DateTime @default(now())` to the
`User` model, ran `prisma db push` (confirmed with the user first — existing
users will show the push date as their "member since," not their true
original signup date, since that was never recorded), updated the route to
compute both for real. Not currently rendered anywhere in the UI, but fixed
at the source since it's exactly the kind of silently-wrong data a future
feature (or the AI's own context-builder) could pick up as real.

### A visual bug found during the same pass
`components/pomodoro-widget.tsx`'s non-focus-page position (`top-6 right-16`,
`z-50`) sits fully inside the screen region `components/ai/modern-chatbot/
chatbot-sidebar.tsx`'s full-height right panel (`right-0`, up to 400px wide,
also `z-50`) covers when open — and the sidebar mounts later in
`client-layout.tsx`, so it wins the z-index tie and covers an active,
running Pomodoro timer. Bumped the widget to `z-[55]` so a live countdown
stays visible above the chat panel.

### Stripe monetization — built end-to-end this session
- `prisma/schema.prisma` — `Subscription` model (Stripe customer/subscription
  IDs, status, interval, `cancelAtPeriodEnd`) + `User.plan` (denormalized
  `'free'|'pro'`, avoids a join on every AI-action gating check).
- `lib/stripe.ts` — shared client, **lazily constructed via a `Proxy`**
  wrapping a `getStripe()` accessor, specifically so importing the module
  never throws when `STRIPE_SECRET_KEY` is unset (local dev, `next build`
  page-data collection) — a bare `new Stripe(...)` at module scope crashed
  the build the first time this was tried.
- `app/api/billing/checkout/route.ts`, `.../portal/route.ts`,
  `.../status/route.ts`, `app/api/webhooks/stripe/route.ts` — Checkout
  session creation, Billing Portal redirect, plan/usage status read, and the
  webhook (`checkout.session.completed` / `customer.subscription.updated` /
  `.deleted`) that upserts `Subscription` and denormalizes `User.plan`.
- `lib/ai/executor.ts` — `FREE_PLAN_MONTHLY_ACTION_LIMIT = 20` (exported,
  reused by the status route) + `checkFreePlanLimit()` gate inserted right
  before handler dispatch: free-plan users get blocked with an upgrade
  message once they hit 20 `AiActionLog` rows in the current calendar month;
  Pro is unlimited.
- `components/settings/settings-billing.tsx` (new "Plan" tab in Settings) +
  `app/landing/page.tsx` (new pricing section, Free vs Pro cards) — the
  billing tab polls `/api/billing/status` for a few seconds after a Stripe
  Checkout redirect (`?upgraded=1`) since the webhook can lag a few seconds
  behind the redirect, showing a "confirming payment" state instead of
  nothing.
- All Vercel env vars set with the established `--no-sensitive` workaround:
  `STRIPE_SECRET_KEY`, `STRIPE_PRO_MONTHLY_PRICE_ID`,
  `STRIPE_PRO_YEARLY_PRICE_ID`, `NEXT_PUBLIC_APP_URL`, and later
  `STRIPE_WEBHOOK_SECRET` once the user registered the webhook endpoint in
  the Stripe Dashboard. End-to-end verified: real Checkout redirect,
  `400 Invalid signature` confirmed the webhook route is live and validating
  signatures (not just present).
- Test purchases made directly in the Stripe Dashboard (not through
  Novo's own checkout flow) don't carry `client_reference_id`/
  `metadata.userId`, so they never reach a real user's plan — this isn't a
  bug, just means testing has to go through Settings → Plan → the actual
  upgrade button, with a Stripe test card (`4242 4242 4242 4242`).

## What has NOT been done / deliberately deferred

1. **OpenRouter key is empty in Vercel** (401 on every request) — needs a
   real key from the user, then `vercel env add ... --no-sensitive --yes`.
2. **3D cognitive-graph upgrade** and **deep visual redesign of the landing
   page** — both explicitly held for a session with visual verification
   (screenshots or live browser), given the real regression risk of blind
   large visual changes on this codebase (documented prior break from a 3D/
   fiber React-reconciler conflict).
3. **Lenis smooth scroll on the landing page** — library is installed, the
   provider component (`components/smooth-scroll-provider.tsx`) is proven in
   production elsewhere (sidebar), but wiring it into the landing requires
   first moving `FloatingNav` from `sticky` to `fixed` (Lenis's
   content-transform breaks `position: sticky` descendants) — real
   structural change, deferred pending visual verification.
4. **Cognitive Twin Profile section from the mockup** (Archetype "Strategic
   Builder", Focus Style "Deep Diver", Learning Style, etc.) and the
   mockup's invented insight percentages — explicitly rejected as
   fabrication per the user's own "solo lo real" decision. Would need a
   genuine model (real historical pattern analysis) before this could be
   built honestly, not just displayed.
5. **Broader TypeScript debt** — `next.config.mjs` still has
   `typescript.ignoreBuildErrors: true`; a full `tsc --noEmit` this session
   showed ~76 pre-existing errors across the codebase (down from ~101 at a
   much earlier point this project — no regressions introduced this
   session, but not a clean baseline either). Not touched beyond confirming
   no new errors after each change.
6. Earlier-session deferred items (voice pipeline unification across
   `lib/ai/executor.ts` / `useGeminiLiveAgent.ts` / `lib/voice-executor.ts`,
   the 3 dead chatbot files, cognitive graph backlog) — see the archived
   session below; not revisited this session.

## Immediate next steps for the next session

1. Get a real OpenRouter key from the user and configure it (restores the
   3rd AI rescue tier).
2. If the user wants to tackle the landing redesign or 3D graph: needs a
   session with visual verification (screenshots, live browser, or the user
   testing and reporting back) — don't attempt blind.
3. If picking up Lenis on the landing: move `FloatingNav` to `fixed`
   positioning first, verify visually, then wire
   `SmoothScrollProvider scrollRef={scrollRef}` around the page content.
4. Ask about the older deferred items below if they're still relevant
   (dead chatbot files, voice pipeline unification, TS debt cleanup).

---

# Archive — previous session (2026-07-06 → 2026-07-07)

Everything below is preserved from the prior handoff for historical context.
Dates/paths/line numbers may be stale — verify against current code before
relying on specifics.

## State at that time

**Deployed to production.** Everything described below (including the newer
"Mobile fullscreen AI chat sheet" section) shipped via
`vercel deploy --prod --yes`, live at **https://productivitynovo.vercel.app**
(readyState `READY`, last deployment id `dpl_H6cSnymrniraetBePjpoMKnnsa82`).
**Nothing was committed to git** at that point — that session (like others
before it) deployed straight from the working directory;
`git status --short` still showed ~200+ uncommitted changed files. That's a
pre-existing pattern in this project, not something to "fix" reflexively —
but worth knowing if a session expects `git log`/`git diff` to reflect what's
actually running in production (it won't).

## That session's latest batch: mobile chat polish + a real cross-cutting layout bug

Shipped after the PulseChat chatbot redesign further below. In order:

- **Header divider removed, composer lightened** (`components/ai/modern-chatbot/index.tsx`, `chat-input.tsx`) — the chat header's solid background/border was removed per explicit user request ("elimina esa división para solo dejar los botones flotantes"), leaving just the individual floating pill buttons over the same gradient background as the rest of the page. The composer's accessory row (attach/web-search/model-selector/send) lost its divider line and switched from bordered icon boxes to ghost icon buttons — less visual chrome, same functionality.
- **Root-cause fix for "se desborda en la parte inferior al momento de cargar el chat"** — this was NOT a chatbot bug. `components/dashboard-shell.tsx:65` (the root container for the *entire* authenticated app shell, not just `/ai`) used `h-screen` (`100vh`, static). On real mobile browsers, `100vh` is sized against the largest possible viewport (address bar collapsed) — right after page load, with the address bar still expanded, the actual visible viewport is shorter, pushing bottom content (like the chat composer) below the visible fold. Fixed by switching to `h-dvh` (dynamic viewport height, tracks the real visible area live). **This fix could not be verified with Playwright** — headless Chromium has a fixed viewport with no collapsing address bar, so this class of bug is invisible to that kind of testing by construction. It's verified only by reasoning about the mechanism (confirmed to exactly match the reported symptom) — worth a real-device check if the report resurfaces.
- **`package.json`'s `dev` script now includes `--webpack`** — a second verification agent found `npm run dev` (no flag) now reliably crashes on this machine too, not just `next build` (same underlying Turbopack-native-binary-segfaults-on-Windows issue documented in `next.config.mjs`'s `ponytail:` comment). `dev`, `build`, and `vercel-build` all pass `--webpack` now.
- **Mobile fullscreen AI chat sheet** (`components/ai/modern-chatbot/mobile-chat-sheet.tsx` new, `components/mobile-nav.tsx` changed) — the user shared a reference screenshot (curved-top sheet sliding to fullscreen above a persistent floating nav bar) and explicitly chose the more ambitious of two options offered: a *real* GSAP shared-element transition from the nav bar's AI button, not a simple page transition. The mobile "AI" nav button no longer does `router.push('/ai')` — it opens a `fixed inset-0` sheet (`rounded-t-[32px]`, top corners only) via the same `useModalFlip` engine already used for the "+" → section-drawer flip in the same file, with a matching backdrop and deferred-unmount close. Desktop `/ai` (`app/ai/page.tsx`) is untouched, still a normal route.
  - **Found and fixed a real bug while building this**: `components/ai/modern-chatbot/index.tsx`'s `ModernChatbot()` was wrapping its content in its own `<ChatbotProvider>`, *nested inside* the one already provided app-wide in `app/client-layout.tsx`'s `AppProviders`. Because React context resolves to the nearest ancestor provider, this meant `/ai`'s conversation state and `components/ai/modern-chatbot/chatbot-sidebar.tsx`'s (the legacy always-mounted-offscreen "OmniHub v2" panel — both call `useChatbot()`) were silently running on two *different* provider instances, never synced. Removed the redundant nested provider — now the desktop `/ai` page, the new mobile sheet, and `ChatbotSidebar` all genuinely share one conversation state. Verified: sent a message in the mobile sheet, confirmed it persisted via `GET /api/ai-conversations`, and confirmed it's still there on reopening the sheet.
  - `ModernChatbot` gained an optional `onMobileClose` prop — when the mobile sheet passes it, the chat header's "back" button calls it (closing the sheet) instead of being a `<Link href="/">`.

## That session's "not done / deferred" (updated)

Everything in that session's original list further below still applied. Additionally:
- The visual "underfill" gap a diagnostic agent noticed on desktop `/ai` (chat card only filling ~640 of 900px height) was flagged as possibly a test-environment artifact (the dev server was extremely unstable/slow during that specific diagnostic run) rather than a confirmed real bug — not fixed, not confirmed either way.

## Build tooling gotcha — still relevant, read before running `next build` yourself

`next.config.mjs` has a `ponytail:` comment: *"--webpack flag required for
prod builds on Windows; Turbopack native binary segfaults."* **Always run
`next build --webpack`** when verifying locally before a deploy — plain
`next build` (Turbopack, the Next 16 default) is prone to crashing on this
machine. The actual Vercel deploy was never at risk from this:
`package.json`'s `vercel-build` script already runs
`prisma generate && next build --webpack`.

Separately, that session hit a second, compounding issue: genuine **OS-level
memory exhaustion** (only 3.4GB total RAM), made worse by leftover
`chrome.exe`/`node.exe` processes accumulated from many Playwright verification
agents run back-to-back over a very long session. One local build attempt
crashed with an explicit `FATAL ERROR: ... JavaScript heap out of memory` while
only ~843MB was free system-wide. **Fix: the user closed Chrome
(freed ~843MB → ~2GB), then the `--webpack` build succeeded cleanly.** If a
future session hits build segfaults/OOM again: (1) confirm `--webpack` is
being passed, (2) check `tasklist`/free memory, (3) ask the user to close other
apps rather than guessing which processes are safe to kill — an auto-mode
classifier will (correctly) block killing processes or files that weren't
explicitly named by the user.

## What shipped in that session (chronological, most recent first)

### PulseChat-derived chatbot redesign ("quiero esa ui")
The user shared a standalone reference React component ("PulseChat" — glowing
orb, step-by-step "thinking" display, minimal floating pill input) and a
Three.js 3D graph reference, and asked for the chatbot UI specifically — not
just borrowed pieces bolted onto the existing design (see below for the
distinction, since the first pass under-delivered on this and needed a
correction). Final state, all in `components/ai/modern-chatbot/`:

- `glowing-orb.tsx` (**new**) — shared `GlowingOrb({state, size})`
  idle/listening/thinking/speaking orb. Replaced 3 separate hand-rolled
  orb/circle implementations (`DesktopHero`, `MobileHero`,
  `VoiceListeningOverlay`) and the plain bouncing-Mic voice banner in
  `chat-input.tsx`.
- `thinking-steps.tsx` (**new**, replaces the dead `thinking-indicator.tsx`) —
  shows real pipeline stages ("Analizando tu mensaje" → "Conectado a
  {model}...") sourced from the real `meta` SSE event `/api/ai/stream` already
  emits (model/intent/fallback from the actual server-side classifier) —
  nothing fabricated client-side.
- `welcome-hero.tsx` — `DesktopHero` stripped down to **only** an orb + "Good
  {time}, {name}" / "How can I help you today?" — no embedded input box, no
  quick chips, no suggestion cards (all removed to match the reference's
  minimalism). `MobileHero` unchanged (it already matched the reference well)
  aside from using the shared orb.
- `index.tsx` — now owns **one persistent** `<ChatInput variant="bottom">`,
  rendered as a sibling of the hero/chat-area swap, always docked at the
  bottom regardless of hero/active-chat state (previously `DesktopHero` had
  its *own* separate embedded input AND `chat-area.tsx` had *another* one —
  two different-looking composers depending on state). Added PulseChat's exact
  bottom radial gradient (`from-[#1b4b8a] via-[#0b1b36] to-transparent`)
  replacing the old primary/violet ambient blur orbs. Also fixed a real
  pre-existing bug: this file always rendered `DesktopHero` regardless of
  viewport, making `MobileHero` structurally unreachable (it lived inside
  `chat-area.tsx` behind a condition that could never be true there) — now
  both heroes render, gated by CSS breakpoint (`md:hidden`/`hidden md:flex`).
- `chat-area.tsx` — simplified to a pure message list: removed the
  now-fully-dead hero-fallback branch, removed a duplicate voice-overlay
  state (now solely owned by `index.tsx`), removed its own composer (moved to
  `index.tsx`; `--composer-h` CSS variable still reaches this component's
  scroll-padding calc via normal CSS inheritance from a shared ancestor).
- `message.tsx` — lighter, flatter text flow matching the reference: removed
  the per-row background tint on assistant messages, added `font-light` to
  markdown paragraph text.
- `context.tsx` — (a) `sendMessage` now captures `intent`/`fallback` from the
  `meta` event for `thinking-steps.tsx`; (b) **fixed a real stale-closure
  bug**: line ~780 used `c.id === currentConversationId` (React state, stale
  for the very first message of a brand-new conversation) instead of
  `c.id === activeConversationId` (the function-local variable already used
  correctly elsewhere in the same function) — **this was silently discarding
  every assistant reply to the first message of any new conversation**, found
  by a verification agent, root-caused, and fixed; (c) added a client-side
  fallback in the `catch` block pushing a visible `⚠️ No se pudo obtener una
  respuesta: ...` message instead of only setting inert `error` state nothing
  rendered.
- `app/api/ai/stream/route.ts` — **fixed a third real pre-existing bug**: the
  stream-reading `catch` block (~line 525) only did `console.error` on a read
  failure, closing the stream with the `meta` event already sent but **zero
  content chunks ever enqueued** — the client saw a "successful" empty stream
  and rendered nothing, no error surfaced anywhere. Fixed by enqueueing a
  visible `⚠️ La respuesta se interrumpió inesperadamente` content chunk in
  that catch, mirroring the already-correct pattern a few lines above for the
  `!groqResponse.ok` case.

All 4 of the above bugs were found via repeated Playwright verification
passes (not caught by `tsc`/`next build`), then re-verified fixed before
deploy — send-a-real-message end-to-end, first message of a new conversation,
second message in the same conversation, mobile + desktop viewports.

**Was awaiting explicit user go-ahead to delete** (confirmed dead/
unreferenced at the time; an auto-mode classifier blocked an unprompted `rm`
since it was inferred rather than instructed): still not deleted as of this
session —
- `components/ai/modern-chatbot/thinking-indicator.tsx` (superseded by `thinking-steps.tsx`)
- `components/ai/floating-chatbot.tsx` (confirmed zero live importers at the time)
- `components/__tests__/chatbot.test.tsx` (stale test for the above)

**Known, out-of-scope issue surfaced during that session's verification —
resolved this session (2026-07-11), see "Chatbot: three real bugs" above**:
`components/ai/modern-chatbot/chatbot-sidebar.tsx` (the "OmniHub v2" companion
panel) rendering its own composer/message actions sharing `useChatbot()`
state turned out to hide a real no-op-callback bug, not just a duplicate-
surface design question.

### Earlier in that session (deployed together with the above)
- `lib/inngest/functions/process-twin-signal.ts` — fixed a real correctness
  bug: `occurredAt` comes back as a JSON string after crossing an Inngest
  `step.run` checkpoint boundary, but 4 inference rules (procrastination/
  overcommitment×2/cognitive-load) compared it against a real `Date` with
  `>=` — comparing mismatched stringified forms, not chronologically. Fixed
  by re-hydrating to `Date` once at the load site. (Note: this session found
  that Inngest itself was never receiving events in production at all — see
  "The Twin never actually learned in production" above — so this fix only
  started mattering once the inline-execution fix landed.)
- `app/globals.css` — moved the entire "Novo Liquid Glass Tier System"
  (`.liquid-glass`, `-elevated`, `-premium`, `-hover` + dark overrides) from
  `@layer utilities` to `@layer components`, fixing a real bug where
  `.liquid-glass-elevated`'s own `position:relative` was cascade-tied with
  Tailwind's `.fixed` utility and won via source order — this had made the
  mobile nav section-drawer panel overflow 16px off the right edge of the
  viewport.
- `lib/cognitive-graph.ts`, `app/api/cognitive/graph/route.ts`,
  `components/cognitive/cognitive-graph-view.tsx` — the cognitive graph now
  "evolves": nodes get an `isNew` pulse when a recent `TwinEvolutionLog` row
  (last 7 days) touched that dimension.
- `app/api/cognitive/decisions/route.ts` (new),
  `components/cognitive/decision-feed.tsx` (new), `app/cognitive/page.tsx` —
  new "Bitácora del Twin" feed next to the graph, reading straight from
  `TwinEvolutionLog` — the audit-trail proof for the hackathon's "AI-Native
  Ops" judging criterion. (This session added `AiActionLog` alongside it and
  merged both into one feed — see the AI-Native Ops work; not re-detailed
  here since it happened in a gap between the two handoff snapshots.)
- `lib/cognitive-context.tsx` (`FatigueNavigationWarning` repositioned to
  `top-4 right-4`, was covering page `<h1>`s), `components/command-palette.tsx`
  + `components/mobile-section-drawer.tsx` (mobile search FAB reworked into a
  "Buscar" footer button + `open-command-palette` custom event, after the
  floating FAB kept losing screen-space fights with other floating buttons —
  first with `mobile-nav.tsx`'s FAB, then with `GeminiLiveOrb`'s),
  `components/cognitive/primitives.tsx` (telemetry pill labels wrap instead of
  truncating to "…"), `app/cognitive/page.tsx` header (no longer wraps on
  mobile) — 4 fixes from an explicit visual-overflow audit the user requested.

## What had NOT been done / deliberately deferred (as of that session)

1. **Voice pipeline unification** — the codebase has **three parallel,
   un-unified "AI takes an action" systems**: `lib/ai/executor.ts` (has real
   confirmation UI + ID-ownership checks), `hooks/useGeminiLiveAgent.ts` /
   `GeminiLiveOrb` (bypasses `executor.ts`, calls `/api/tasks` etc. directly,
   no confirmation), and `components/ai/VoiceCommandHub.tsx` +
   `lib/voice-executor.ts` (a third, Whisper-based pipeline). Flagged during
   that session's exploration, not touched — unifying them is a real,
   separate, higher-risk project of its own. **Still not touched as of
   2026-07-11.**
2. **3D cognitive-graph upgrade** — the user shared a Three.js reference
   (`gemelo_cognitivo.html`, a force-directed 3D node sphere with
   `OrbitControls`) and said "con el esquema de ese grafo podemos hacer algo
   mas grande y mejor" — read as an idea for later, not an explicit
   instruction. **Still deferred as of 2026-07-11**, now with an explicit
   reason (needs visual verification, prior 3D attempt broke the app).
3. **Broader TypeScript debt** — see current-session note above; the error
   count has moved (74 → ~76) but the underlying decision (fix only
   errors that are confirmed live bugs, leave the rest cataloged) is
   unchanged.
4. **Cognitive graph backlog** from an earlier audit, not yet implemented:
   wiring Calendar/Fit/Notion signals in as graph nodes (highest impact);
   mobile tap not persisting node-selection highlight (**note: tap-to-select
   was added this session (2026-07-11)** — worth checking if this backlog
   item is now resolved); the force-layout `requestAnimationFrame` loop never
   stops even at rest; more "insight" cross-link edges beyond the single
   bottleneck↔signal pairing.
5. **The 3 dead chatbot files** and the **duplicate `ChatbotSidebar`
   composer** — the composer/message-actions half of this turned out to be a
   real bug, fixed this session (see above). The 3 dead-file deletions are
   **still pending explicit user go-ahead**.
