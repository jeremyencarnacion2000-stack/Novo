# Landing Page Redesign — Design Spec

## Context

`app/landing/page.tsx` (488 lines) is Novo's public marketing page: hero with a
dark, dynamically-loaded 3D neural graph (`components/landing/hero-graph-3d.tsx`),
then six sections — real product screenshot, "Antes / Con Novo" reframe, a
5-stage "cómo funciona" pipeline, three differentiators, two-tier pricing, and
a final CTA — all dark-themed (`bg-white/[0.03]` glass cards, `text-white/XX`
text, indigo glows).

The copy and structure are already honest: a real screenshot
(`/landing/product-ai.png`), no fake testimonials or customer logos, real
pricing, a real feature pipeline. This redesign is a **visual and tonal
overhaul**, not a content rewrite.

## Goal

Shift the landing page from its current dark "cognitive/neural showcase" tone
to a warm, human, editorial tone (Notion/Superhuman reference point) —
reinforcing the human-potential/education angle of the XPRIZE submission
rather than only the technical one — while keeping the existing brand indigo
(`#6366f1`) as the through-line into the actual (dark, indigo-branded) app
users land in after signup.

## Palette & Typography

- **Background**: warm cream/off-white (`~#FBF7F1`), replacing the current
  near-black base.
- **Text**: warm near-black (`~#221D16`), replacing `white/XX` opacity scales.
- **Primary accent**: unchanged — brand indigo `#6366f1`, used for CTAs, links,
  the "Pro" plan highlight, and icon accents. Deliberately not replaced with a
  warm hue, to avoid a jarring identity break at the signup moment.
- **Secondary accent**: a soft terracotta/coral (`~#E8734A`), used sparingly
  for illustration accents and small badges — this is what actually delivers
  the "warm" feeling, since the primary accent stays cool.
- **Cards**: today's frosted-on-black glass (`bg-white/[0.03] backdrop-blur-xl
  border-white/[0.08]`, black-glow shadows on hover) becomes frosted-on-cream
  (soft paper-white cards, warm-toned shadows on hover) — same glass-card
  *feel*, flipped brightness.
- **Glows**: the indigo glow behind the final CTA and around hover states is
  far more visible on dark than light backgrounds — recalibrate opacity/blur
  per section rather than doing a direct color swap, and reserve the strongest
  glow for actual CTA buttons so it still reads as "the important action."

## Hero

Full replacement of the current 3D neural-graph hero.

- Existing headline/subhead copy is restyled, not rewritten.
- A real screenshot of the "Ahora →" decision-hero card (the actual honest
  cold-start feature shipped earlier this session) is captured live via
  `agent-browser`, using the existing dogfooding session, and shown as a clean
  floating device-frame card — this replaces the graph as the hero's visual
  anchor.
- A soft, AI-generated background illustration (a calm/focused person, warm
  tones) sits behind the product shot, subtle enough not to compete with it.
- `components/landing/hero-graph-3d.tsx` and its dynamic import in
  `app/landing/page.tsx` are deleted entirely — this concept is retired, not
  relocated elsewhere on the page.

## Content Sections (unchanged structure, restyled)

All six sections below keep their existing copy, data, and layout — only
color/surface treatment changes:

1. **Real screenshot** (`product-ai.png`) — stays, browser-chrome frame
   restyled to light.
2. **"Antes / Con Novo" reframe** — same two-card contrast; "Antes" goes
   neutral warm gray, "Con Novo" keeps an indigo tint recalibrated for light
   backgrounds (lighter wash instead of the current dark glow).
3. **"Cómo funciona" pipeline** (5 stages) — same grid, restyled cards, icons
   stay indigo.
4. **Differentiators** (3 columns) — same grid, restyled cards.
5. **Pricing** (Free / Pro) — same two-tier layout and copy, restyled cards;
   "Recomendado" badge and Pro CTA keep indigo glow, recalibrated for light
   backgrounds.
6. **Final CTA + footer** — same copy; radial indigo glow behind the headline
   toned down/lightened for the new background.

## Motion & Assets

- **Scroll motion**: keep the existing `ScrollReveal`/Framer Motion pattern;
  tone down hover glows across all cards to match the lighter palette (subtle
  warm shadow instead of indigo blur on every hover — indigo glow reserved for
  CTAs).
- **Lenis smooth scroll**: added on the landing page only (pre-approved for
  landing per prior animation-stack decision, not yet installed —
  `npm install lenis`).
- **No sound micro-interactions** — explicitly out of scope per user decision
  during design review.
- **Real screenshots**: captured via `agent-browser` against the existing
  dogfooding session — the "Ahora →" hero card, plus reuse of the existing
  `/landing/product-ai.png` chat screenshot. Saved under `public/landing/`.
- **AI-generated imagery**: 1–2 warm, calm illustrations generated to match
  the exact palette (not stock-sourced), for the hero background and
  optionally one supporting section. Saved under `public/landing/`.

## Technical Plan

- **Files touched**: `app/landing/page.tsx` (in-place restyle, single file,
  same local-component-function pattern already used for `HeroGraph` /
  `FloatingNav`).
- **Files deleted**: `components/landing/hero-graph-3d.tsx`.
- **New files**: generated/captured image assets under `public/landing/`; a
  small Lenis wiring point (inline hook or `lib/landing/lenis.ts` — whichever
  is the smaller diff at implementation time).
- **Dependency added**: `lenis`.
- **No parallel route, no extracted design-system layer** — single in-place
  rewrite (see Approach A in brainstorming discussion; Approaches B/C
  rejected as unnecessary process overhead for a single marketing page with
  no live-traffic risk).

## Testing / Verification

Presentational change — no business logic to unit test. Verification is a
manual pass via `agent-browser`:

- Load `/landing` at mobile and desktop viewport widths — confirm no
  layout shift or horizontal overflow.
- Confirm `prefers-reduced-motion` is respected (existing reduced-motion
  handling in the file already gates animations; must still hold after the
  restyle).
- Confirm real screenshots load correctly and Lenis scroll behaves smoothly.

## Rollout

Single commit, deployed straight to production following this session's
established workflow (typecheck → build → `vercel deploy --prod` → alias →
`git push`). No feature flag — marketing page, no user data at risk.
