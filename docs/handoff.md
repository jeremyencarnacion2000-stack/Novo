# Handoff — Novo session (2026-07-17)

## Project

**Novo** — a "Cognitive Operating System," not a productivity app. Core thesis: a
"Cognitive Twin" continuously models the user's attention/energy/habits/workload
from real behavioral signals and answers "what should this person do right now?"
Next.js 16 (App Router), Prisma/Postgres (Neon), NextAuth, Tailwind v4, deployed to
Vercel at **https://productivitynovo.vercel.app**.

**Why this matters right now:** Novo is competing in the "Build with Gemini
XPRIZE" hackathon (Category 1, Education & Human Potential, $2M pool, **deadline
Aug 17 2026** — ~31 days out as of this session), judged on real revenue +
"AI-Native Ops" (does the AI visibly/provably execute real decisions
autonomously). The $500k prize funds scaling Novo *and* the user's other
businesses. (Full context also lives in the auto-memory system —
`project-xprize-hackathon.md`, `project-xprize-priorities.md`,
`project-hackathon-stakes-succession.md`, `novo-product-philosophy.md`.)

## State right now (2026-07-17)

**Deployed to production**, verified after every change this session via
`npx vercel deploy --prod --yes` + `npx vercel alias set <deployment-url>
productivitynovo.vercel.app` (the custom domain does not auto-follow a new
prod deploy — this manual alias step is required every time; capture the
deployment URL directly from the deploy command's own output, don't pipe it
through `tail` first or the URL gets lost). Workflow used this session:
`NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit` (authoritative
type-check) → `npx jest` (20/20 suites) → deploy → alias → live curl/API
verification against real accounts before calling anything done.

**Nothing has been committed to git this session** (or in prior sessions —
`git status --short` still shows 70+ modified files). Deploys go straight from
the working directory; commit status doesn't affect what's live. If a real git
history is wanted at some point, that needs an explicit ask — never commit
without being asked.

A huge amount of AI-pipeline, generative-UI, chatbot-polish, and landing-page
work shipped this session — see below.

## What shipped this session (chronological-ish, grouped by theme)

### AI pipeline correctness — several real, previously-undiscovered bugs

- **Groq's primary model was wrong for the job.** `qwen/qwen3-32b` has a 6000
  TPM free-tier limit; the ACTION_PROMPT (tools + skills + cognitive context)
  alone tokenizes to ~7700 tokens under Qwen's tokenizer, so *every*
  action-classified message (create task, plan, schedule, etc.) failed with a
  413 `rate_limit_exceeded`. Verified live via the `x-ratelimit-limit-tokens`
  response header across several Groq models; switched to
  `llama-3.3-70b-versatile` (12000 TPM) everywhere it's used as primary. This
  was likely silently breaking most real action requests before this session.
- **A decommissioned Groq model (`llama3-8b-8192`, 404 on every call) was
  hardcoded in three places**: `lib/ai/router.ts` (intent routing for the
  now-dead `/api/ai/generate` endpoint), and — more importantly —
  `lib/inngest/functions/daily-insights.ts` and
  `lib/inngest/functions/process-focus-session.ts`, i.e. the autonomous
  daily-insight cron path that's the project's literal "AI-Native Ops"
  evidence for the hackathon judges. This had been silently failing/producing
  nothing for however long. Fixed to `llama-3.1-8b-instant` in both.
- **`reasoning_format: 'hidden'` regression, self-inflicted mid-session.**
  Added it unconditionally to `lib/groq.ts` to stop qwen3-32b's `<think>`
  trace leaking into chat responses — but that param is qwen3-specific and
  broke every other model with a 400 "reasoning_format is not supported with
  this model" the moment it shipped (caught via the cognitive-engine using
  `llama-3.3-70b-versatile`). Now gated on `model.includes('qwen3')`.
- **Cerebras added as a new fallback provider** (`lib/cerebras.ts`), wired into
  both `/api/ai/generate`'s model list (replacing the old dead Grok slot) and
  `/api/ai/stream`'s rescue chain (before the also-dead Gemini rescue). **Not
  live yet** — the user's key authenticates fine (`GET /v1/models` → 200) but
  any actual completion returns `402 payment_required_error`. Needs a payment
  method added at cerebras.ai. This account's only available models are
  `gemma-4-31b` / `zai-glm-4.7` / `gpt-oss-120b` (no Llama) — using
  `gpt-oss-120b`. Code auto-recovers once billing is enabled, no further
  changes needed.
- **Gemini / Grok / DashScope remain billing/key-gated**, unchanged from
  before this session (Gemini: free-tier quota structurally `limit: 0`, needs
  Google Cloud billing; Grok: xAI account out of credits *and* a dead model
  id `grok-2-1212`; DashScope: `401 Invalid API-key`, needs a fresh key). Grok
  and DashScope are deliberately left in code behind `if (false && ...)`
  gates in `app/api/ai/generate/route.ts` with dated comments — not deleted,
  so they auto-recover once the user fixes the underlying account issue.
- **The cognitive engine was hallucinating for brand-new users.** Tested with
  a genuinely fresh throwaway account (zero tasks, zero focus sessions, zero
  history) and got back: *"You have a historical pattern of high productivity
  during your peak window, with an average focus score of 85 and a 7-day
  completion rate of 50%..."* — entirely invented. Root cause:
  `completionRate` silently defaulted to `50` for zero-task users (a
  plausible-looking fake number), which then fed an AI prompt that
  *unconditionally* instructed "one sentence about a historical pattern
  detected" with no cold-start guard — even though this same file already had
  a correctly-wired `isColdStart` guard for the task list and for the
  deterministic fallback path, just never extended to this spot. Fixed in
  `app/api/ai/cognitive-engine/route.ts`: `completionRate` is now `null` for
  zero-task users, the prompt says "no data yet — this user has no task
  history at all" instead of `null%`, and the `cognitiveMemory` instruction is
  now conditional on `isColdStart`. Re-verified live with the same fresh
  account: now correctly says *"Not enough history yet — this fills in as you
  use Novo."*
- **Generative UI mismatch fixed.** The assistant's own text narrates actions
  as already done ("He creado tu tarea") per the system prompt's "you simply
  DO things" rule — but a generic `confirmation` block was gating *every*
  action, including plain creates, behind a manual Confirm click. Text said
  "done", card said "are you sure?". Fixed in
  `components/ai/modern-chatbot/context.tsx`: additive/reversible action types
  (CREATE_TASK, CREATE_NOTE, CREATE_ROUTINE, GENERATE_FILE,
  UPDATE_COGNITIVE_STATE, etc.) now auto-execute via the same
  `/api/ai/execute` path and show a completed `result` block immediately;
  destructive/mutating actions (DELETE_*, UPDATE_TASK, etc.) still require the
  manual confirm — a misclassified id there is harder to walk back.
- **`editMessage` (edit-and-resend in chat) refactored.** Was a ~140-line
  duplicate of the stream-reading loop that only ever accumulated raw text —
  no JSON action-block parsing at all, so an edited message that triggered an
  action showed the model's literal ` ```json ` fence instead of a card. Now
  delegates to `sendMessage` directly (same pattern `retryMessage` already
  used) — down to ~12 lines, and edits get the full generative-UI pipeline.
- **Intent classifier false-positive fixed.** "¿Qué puedes hacer por mí?" (a
  generic question) was classified as `TASK` purely because "hacer" (a common
  Spanish verb) matched the `actionVerbs` list, with *zero* entities detected
  — `lib/ai/classifier.ts` defaulted to TASK on `hasActionVerb` alone. Now
  requires an actual entity (tarea/rutina/proyecto/habito/nota) before
  classifying as an action type; a bare action verb no longer suffices.
  Verified live: same message now returns `intent: "GENERAL"`.

### Chatbot UI

- Fixed a "double dropdown" bug: the conversation-history drawer had its own
  header/close button *and* the embedded `Sidebar` component had its own
  separate collapse header/toggle stacked inside it. `Sidebar` now takes an
  `embedded` prop that suppresses its own header and forces expanded state
  when used inside the drawer. Removed the brain icon from the drawer header
  (replaced with the same small glow-dot accent used elsewhere).
- Redesigned the composer into a floating rounded card (`rounded-[28px]`,
  glass blur, glow border on focus) instead of an edge-to-edge bar.
- "Adjuntar"/"Herramientas" are now visible labeled pills (previously both
  hidden behind one bare unlabeled "+"); "Herramientas" toggles web search
  directly with one click instead of opening a popup for it. Added a mic
  button next to send.
- Added quick-suggestion chips + a subtitle line to the desktop empty-state
  hero — the `SUGGESTIONS` array already existed in `chat-input.tsx` but was
  never rendered on desktop (mobile already had its own hardcoded chip list).
- **Theme unification**: 10 hardcoded near-black hex backgrounds across 8
  chatbot files (`#030305`, `#0B0B0F`, `#09090e`, `#0d0d0f`, `#0a0f1e`) — all
  slightly different shades, and completely unresponsive to the app's actual
  light/dark theme setting — replaced with `var(--background)` /
  `var(--popover)`, the same tokens the rest of the app uses. **Explicit
  decision with the user**: did NOT rewrite the ~150 hardcoded `text-white`
  instances across the chatbot (and app-wide) — dark-first is the intended
  brand identity, not a bug, given the landing/onboarding are also
  deliberately dark. Only fix if the user asks for real light-mode support.

### Guided empty states (Notion "behind the scenes" video lens)

Watched "Behind The Scenes Of Notion's INSANE Design" (Notion/Notion Mail team
interview) — thesis: give people primitive building blocks + guided
defaults (a new database shows 5 ghost placeholder rows, not 1), and a
thousand invisible compounding details are what makes something *feel* cared
for vs. merely functional. Applied directly: swept the app for bare "No X
yet" text-only empty states and replaced the worst offenders with icon +
reframed narrative (+ real Twin-data tips where relevant), matching the
pattern that already existed on `today/page.tsx` and `routines-list.tsx`.

Fixed: `components/checklist-client.tsx` (tasks — also surfaces the Twin's
own friction-point tip via a newly-exported `FRICTION_TIP` from
`components/dashboard/now-hero.tsx`, plus 3 ghost placeholder rows showing
the shape of a filled list), `components/trackers/habit-trackers.tsx`,
`components/trackers/metric-trackers.tsx`, `app/school/page.tsx` (courses),
`app/business/page.tsx` (clients + content ideas), `components/profile/
goals-manager.tsx`.

Explicitly re-checked and left alone (already good — some better than what
was built this session): `today/page.tsx`, `routines-list.tsx`,
`notes/page.tsx`, `social/page.tsx`'s shared `EmptyState` component,
`google-contacts.tsx` and `fitness-stats.tsx` (both already surface *real*
permission-troubleshooting text), `book-recommendations.tsx`,
`components/projects/tasks-view.tsx` (already uses a shared
`NovoEmptyState` with a real action), `cognitive-insights.tsx`,
`decision-feed.tsx` (already uses Twin-narrative framing),
`dashboard-habits.tsx` (returns `null` when empty — intentional, a dashboard
widget shouldn't show itself empty, not a bug).

### Landing page — GSAP page transition

Watched a second reference video ("This Page Transition Makes Your Next JS
Site Look 10x More Expensive") showing a clip-path overlay reveal built on
the native View Transitions API / `next-view-transitions`. **Conflict with an
existing decision**: this project already chose GSAP Flip for shared-element
modals specifically *because* of View Transitions' cross-browser
inconsistency — same concern applies to page-level nav. Resolved by building
the same visual effect with GSAP instead of adopting the native API.

- `components/landing/page-transition-overlay.tsx` (new) —
  `PageTransitionProvider` + `usePageTransition()` hook. A fixed full-screen
  div GSAP-tweens via `clip-path: circle()` to cover the screen, calls
  `router.push()`, waits a short fixed beat (Next.js App Router has no "new
  page painted" event without the native API), then retracts. Has a
  try/catch fallback: any GSAP failure navigates immediately rather than
  stranding a conversion-critical click.
- Wired into all 7 signup/signin CTA `<Link>`s in `app/landing/page.tsx` via
  `onClick` + `preventDefault` — no restructuring of the existing
  `Button asChild`/`Link` composition or styling.
- `LandingPage` split into an outer wrapper (provides the context) and an
  inner `LandingPageContent` (consumes `usePageTransition()`) since a
  component can't provide and consume the same context.
- **Not visually click-through verified.** tsc clean, jest green, confirmed a
  clean console-error-free initial page load with correct content — but the
  `gstack browse` tool crash-looped repeatedly all session (see Tooling notes
  below) and a real click-through of the animation was never confirmed in a
  working browser. Worth a manual test.

## Official Devpost submission-requirements email (received 2026-07-17, 1 month out)

Full detail in auto-memory `project-xprize-submission-checklist.md` — summary
here since it changes a priority call below.

**What to submit**: GitHub repo (shared with `testing@devpost.com` +
`judging@hacker.fund` if private), a 3-minute video of the AI operating live
in production (not a slideshow), a 500–1000 word written narrative, revenue
evidence (Stripe export/bank statement + their P&L template, **monthly
breakdown May–August** — needs real accumulated months, not a day-30 number),
expenses (same P&L template, required even at $0), product evidence (agent
execution logs/API usage/screenshots — Novo's `AiActionLog`/`TwinEvolutionLog`
Bitácora feed already covers this), and customer evidence (real contact info
+ testimonials).

Form also asks explicitly: **"If you use an LLM, how you use the Gemini API
for at least one LLM call."** This reads as a hard submission requirement.
Judging boils down to their own 3-part framing: Business Viability, AI-Native
Operations, Category Impact.

**This promotes Gemini from "billing-gated, lower priority than Cerebras" to
the single highest-priority open item.** The submission form apparently
expects at least one real, working Gemini API call — Gemini is currently
non-functional (429, quota `limit: 0`). Root cause confirmed via live search:
this is the standard symptom of **Cloud Billing not linked to the Google
Cloud project** that owns `GEMINI_API_KEY` — not a code bug.

**Google AI Pro (the consumer subscription) does NOT substitute for this.**
Confirmed directly with the user: they asked whether having Google AI Pro
means they can use the Gemini API — answer is no, these are separate billing
systems. Google AI Pro *does* include $10/month in Google Cloud credit that
applies toward Gemini API costs once billing is linked, so it's not wasted,
but the linking step at console.cloud.google.com → Billing still has to
happen first (~5 minutes per Google's own docs and confirmed developer
reports). Novo uses `gemini-2.0-flash` (text model), so it should not be
affected by the separate platform bug that hits some image-generation models
even after billing is linked.

## What has NOT been done / deliberately deferred

1. **Gemini Cloud Billing link** — now the top-priority open item (see above)
   given the submission form's explicit Gemini API question. Link a billing
   account to the GCP project owning `GEMINI_API_KEY` at
   console.cloud.google.com → Billing, then re-verify live (curl the
   endpoint, confirm no 429) before assuming it's fixed.
2. **Cerebras billing** — add a payment method at cerebras.ai to activate
   that fallback tier. Code is ready and will start working automatically.
   Now second priority behind Gemini, since Cerebras is an optional fallback
   tier while a working Gemini call may be a literal submission requirement.
3. **Grok / DashScope billing/keys** — same situation as prior
   sessions, unchanged. Lower priority — Groq + OpenRouter already cover the
   live path reliably.
5. **Landing page transition — real browser click-test.** Load `/landing`,
   click "Empezar gratis", confirm the circle-reveal plays and lands cleanly
   on `/auth/signup`.
6. **Git commits** — nothing committed this session or (per the archive
   below) in prior sessions either. Only an explicit ask changes this.
7. **Broader TypeScript debt** — not investigated this session; prior
   sessions' `ignoreBuildErrors` note may be stale (a later session,
   per auto-memory, turned build enforcement ON and got errors to 0 — verify
   `next.config.mjs`'s current `typescript.ignoreBuildErrors` value before
   assuming either way).
8. Two throwaway test accounts left in the database from this session's live
   verification: `novo-ai-audit-test-*@example.com`,
   `novo-freshcheck-*@example.com`. Harmless, fine to leave or delete.
9. Everything in the archived sessions below that was never explicitly
   revisited (voice pipeline unification, 3D cognitive-graph upgrade, Lenis
   on the landing page, the 3 dead chatbot files pending deletion go-ahead) —
   check whether any of these are still relevant before assuming so, given
   how much has shipped since.

## Immediate next steps for the next session

1. **Gemini Cloud Billing link** — highest priority, per the Devpost
   submission form's explicit Gemini API question above. Confirm with the
   user whether they've done this yet before anything else.
2. Real browser click-test of the landing page transition.
3. Nudge the user toward Cerebras billing if the model-orchestra
   reliability comes up again — second priority, still in the user's control
   (vs. code).
4. Continue the "polish more wow features" thread the user opened — no fixed
   plan was set for this; use judgment or ask where to focus.
5. If the payment-worthiness question comes up again: the last honest answer
   was "closer, not fully yes" — the cognitive engine now gives a genuinely
   personalized first insight instead of hallucinating or falling back to
   canned text, but the "aha moment" still needs to land in the **first
   minute** for a brand-new user, not just once behavioral data accumulates.

## Tooling notes (read before repeating mistakes)

- **`gstack browse` was unstable all session** — repeatedly reset to
  `about:blank` or crash-looped ("Server crashed twice in a row — aborting"),
  across multiple unrelated attempts (onboarding flow clicks, landing page
  loads, CSS-selector clicks). Don't sink much time re-fighting it in a single
  session; fall back to `tsc`/`jest`/direct `curl` verification against real
  API routes and real (throwaway) accounts, and be upfront with the user
  about what specifically wasn't visually confirmed as a result.
- **The command-safety classifier had an extended intermittent outage**
  mid-session — trivial commands (`echo`) passed while `curl`/`tsc`/`jest`
  kept returning "temporarily unavailable" for several minutes at a stretch.
  Retrying eventually works; don't sleep-loop, just retry with brief gaps
  (a quick trivial command in between is a fine way to probe recovery) and
  keep the user informed rather than going silent.
- **Deploy capture gotcha**: piping `vercel deploy --prod --yes` through
  `tail` before capturing the deployment URL loses the URL (it's earlier in
  the output than the last few lines). Redirect full output to a file first,
  then `grep` the URL out of the file.
- Verifying a fresh/cold-start user experience is worth doing via direct API
  calls (`/api/auth/csrf` → `/api/auth/callback/credentials` → hit the target
  route with the cookie jar) rather than fighting a browser tool through a
  full onboarding click-through — much faster and just as valid for
  API-level bugs like the cognitive-engine hallucination found this session.

---

# Archive — previous session (2026-07-11)

## State at that time

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
  **Update from 2026-07-17 session**: the landing page transition work that
  session did was scoped to a GSAP overlay reveal on navigation, not Lenis —
  this Lenis-on-landing item is still untouched as far as that session's
  work indicates.

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
  **Update from 2026-07-17 session**: OpenRouter is now confirmed *working*
  live (verified via direct curl) — whatever the key issue was, it's
  resolved as of that session. Gemini's rescue tier is now confirmed dead for
  a different reason (billing-gated, `limit: 0`), and a new Cerebras rescue
  tier was added ahead of it.
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
  **Update from 2026-07-17 session**: per auto-memory, prod Stripe is still
  `sk_test_` (test mode) as of that session — real payments don't work until
  the user activates their Stripe account for real and swaps in a live key.
  Also: Stripe isn't available in the Dominican Republic; the user was
  exploring a Merchant-of-Record alternative (Lemon Squeezy) as of that
  session — check current status before assuming either path.
- Test purchases made directly in the Stripe Dashboard (not through
  Novo's own checkout flow) don't carry `client_reference_id`/
  `metadata.userId`, so they never reach a real user's plan — this isn't a
  bug, just means testing has to go through Settings → Plan → the actual
  upgrade button, with a Stripe test card (`4242 4242 4242 4242`).

## What has NOT been done / deliberately deferred (as of that session)

1. **OpenRouter key is empty in Vercel** (401 on every request) — needs a
   real key from the user, then `vercel env add ... --no-sensitive --yes`.
   **Resolved as of the 2026-07-17 session** — confirmed working live.
2. **3D cognitive-graph upgrade** and **deep visual redesign of the landing
   page** — both explicitly held for a session with visual verification
   (screenshots or live browser), given the real regression risk of blind
   large visual changes on this codebase (documented prior break from a 3D/
   fiber React-reconciler conflict). Still untouched as of 2026-07-17 aside
   from the scoped GSAP page-transition addition (not a redesign).
3. **Lenis smooth scroll on the landing page** — library is installed, the
   provider component (`components/smooth-scroll-provider.tsx`) is proven in
   production elsewhere (sidebar), but wiring it into the landing requires
   first moving `FloatingNav` from `sticky` to `fixed` (Lenis's
   content-transform breaks `position: sticky` descendants) — real
   structural change, deferred pending visual verification. Still untouched
   as of 2026-07-17.
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
   no new errors after each change. **Per auto-memory, a later session
   before 2026-07-17 got this to 0 and turned `ignoreBuildErrors` OFF** —
   verify current state, this note may be fully stale.
6. Earlier-session deferred items (voice pipeline unification across
   `lib/ai/executor.ts` / `useGeminiLiveAgent.ts` / `lib/voice-executor.ts`,
   the 3 dead chatbot files, cognitive graph backlog) — see the archived
   session below; not revisited as of 2026-07-17 either, as far as that
   session's own handoff indicates.

---

# Archive — earlier session (2026-07-06 → 2026-07-07)

Everything below is preserved from an earlier handoff for historical context.
Dates/paths/line numbers may be stale — verify against current code before
relying on specifics.

## State at that time

**Deployed to production.** Everything described below (including the newer
"Mobile fullscreen AI chat sheet" section) shipped via
`vercel deploy --prod --yes`, live at **https://productivitynovo.vercel.app**
(readyState `READY`, last deployment id `dpl_H6cSnymrniraetBePjpoMKnnsa82`).
**Nothing was committed to git** at that point — that session (like others
before it, and like every session since) deployed straight from the working
directory; `git status --short` still showed ~200+ uncommitted changed files.
That's a long-running pattern in this project, not something to "fix"
reflexively — but worth knowing if a session expects `git log`/`git diff` to
reflect what's actually running in production (it won't).

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
  **Update from 2026-07-17 session**: `DesktopHero` regained a subtitle line
  and quick-suggestion chips (re-added deliberately, not a regression of this
  removal — the chips now reuse the same `SUGGESTIONS` data `chat-input.tsx`
  already had, exported for reuse, rather than being a new hardcoded list).
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
  **Update from 2026-07-17 session**: the composer wrapper's styling changed
  again — now a floating rounded card with margin on all sides instead of an
  edge-to-edge gradient-fade bar (see that session's notes above).
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
since it was inferred rather than instructed): still not deleted as of the
2026-07-11 session, and no evidence the 2026-07-17 session revisited this
either —
- `components/ai/modern-chatbot/thinking-indicator.tsx` (superseded by `thinking-steps.tsx`)
- `components/ai/floating-chatbot.tsx` (confirmed zero live importers at the time)
- `components/__tests__/chatbot.test.tsx` (stale test for the above)

**Known, out-of-scope issue surfaced during that session's verification —
resolved in the 2026-07-11 session, see that section's "Chatbot: three real
bugs" above**: `components/ai/modern-chatbot/chatbot-sidebar.tsx` (the
"OmniHub v2" companion panel) rendering its own composer/message actions
sharing `useChatbot()` state turned out to hide a real no-op-callback bug,
not just a duplicate-surface design question.

### Earlier in that session (deployed together with the above)
- `lib/inngest/functions/process-twin-signal.ts` — fixed a real correctness
  bug: `occurredAt` comes back as a JSON string after crossing an Inngest
  `step.run` checkpoint boundary, but 4 inference rules (procrastination/
  overcommitment×2/cognitive-load) compared it against a real `Date` with
  `>=` — comparing mismatched stringified forms, not chronologically. Fixed
  by re-hydrating to `Date` once at the load site. (Note: the 2026-07-11
  session found that Inngest itself was never receiving events in production
  at all — see that section's "The Twin never actually learned in
  production" — so this fix only started mattering once the inline-execution
  fix landed there.)
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
  Ops" judging criterion. (The 2026-07-11 session added `AiActionLog`
  alongside it and merged both into one feed — not re-detailed here since it
  happened in a gap between the two handoff snapshots at that time.)
- `lib/cognitive-context.tsx` (`FatigueNavigationWarning` repositioned to
  `top-4 right-4`, was covering page `<h1>`s), `components/command-palette.tsx`
  + `components/mobile-section-drawer.tsx` (mobile search FAB reworked into a
  "Buscar" footer button + `open-command-palette` custom event, after the
  floating FAB kept losing screen-space fights with other floating buttons —
  first with `mobile-nav.tsx`'s FAB, then with `GeminiLiveOrb`'s),
  `components/cognitive/primitives.tsx` (telemetry pill labels wrap instead of
  truncating to "…"), `app/cognitive/page.tsx` header (no longer wraps on
  mobile) — 4 fixes from an explicit visual-overflow audit the user requested.

## What had NOT been done / deliberately deferred (as of that earlier session)

1. **Voice pipeline unification** — the codebase has **three parallel,
   un-unified "AI takes an action" systems**: `lib/ai/executor.ts` (has real
   confirmation UI + ID-ownership checks), `hooks/useGeminiLiveAgent.ts` /
   `GeminiLiveOrb` (bypasses `executor.ts`, calls `/api/tasks` etc. directly,
   no confirmation), and `components/ai/VoiceCommandHub.tsx` +
   `lib/voice-executor.ts` (a third, Whisper-based pipeline). Flagged during
   that session's exploration, not touched — unifying them is a real,
   separate, higher-risk project of its own. No evidence any later session
   through 2026-07-17 has touched this either — still open.
2. **3D cognitive-graph upgrade** — the user shared a Three.js reference
   (`gemelo_cognitivo.html`, a force-directed 3D node sphere with
   `OrbitControls`) and said "con el esquema de ese grafo podemos hacer algo
   mas grande y mejor" — read as an idea for later, not an explicit
   instruction. Still deferred as of 2026-07-17 — the user explicitly chose a
   "lightweight 2D enhancement only" for the cognitive graph in a later plan,
   not the full 3D upgrade, per auto-memory. Worth confirming that decision
   still stands before ever picking this back up.
3. **Broader TypeScript debt** — see the 2026-07-11 section's note; per
   auto-memory a session before 2026-07-17 got this to 0 errors with build
   enforcement turned on. Treat this specific item as likely resolved, but
   verify `next.config.mjs` before assuming.
4. **Cognitive graph backlog** from an earlier audit, not yet implemented:
   wiring Calendar/Fit/Notion signals in as graph nodes (highest impact);
   mobile tap not persisting node-selection highlight (tap-to-select was
   added in the 2026-07-11 session — worth checking if this item is now
   resolved); the force-layout `requestAnimationFrame` loop never stops even
   at rest; more "insight" cross-link edges beyond the single
   bottleneck↔signal pairing.
5. **The 3 dead chatbot files** and the **duplicate `ChatbotSidebar`
   composer** — the composer/message-actions half of this turned out to be a
   real bug, fixed in the 2026-07-11 session. The 3 dead-file deletions are
   **still pending explicit user go-ahead** as of 2026-07-17.
