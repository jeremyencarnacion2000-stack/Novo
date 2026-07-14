# Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle `app/landing/page.tsx` from its current dark "cognitive/neural showcase" look to a warm, light, human tone (Notion/Superhuman reference), replacing the 3D graph hero with a real product screenshot + AI-generated imagery, while keeping brand indigo (`#6366f1`) as the accent through-line.

**Architecture:** Single in-place rewrite of one file (`app/landing/page.tsx`), no new routes, no extracted design-system layer. `components/landing/hero-graph-3d.tsx` is deleted. Smooth scroll reuses the existing `SmoothScrollProvider` (already used by `app-sidebar.tsx` and `PageWrapper.tsx` elsewhere in the app) — **no new dependency needed, Lenis is already installed** (`package.json` has `"lenis": "^1.3.18"`).

**Tech Stack:** Next.js App Router, Tailwind (arbitrary hex + opacity-modifier syntax, e.g. `bg-[#241F19]/[0.03]`), Framer Motion (already in file), `lenis` via the existing `SmoothScrollProvider` wrapper, `agent-browser` for real screenshots, image generation for the AI illustration.

## Global Constraints

- Background: warm cream `#FBF6EF`. Text: warm near-black `#241F19`. Primary accent: unchanged brand indigo `#6366f1` (CSS vars at the root div stay exactly as they are today). Secondary accent: terracotta `#E2703F`, used sparingly (illustration tint, at most one badge) — never as a CTA color.
- No sound / audio micro-interactions — explicitly out of scope (user decision during design review).
- Reduced-motion: the deleted `hero-graph-3d.tsx` was the only place in this file with `prefers-reduced-motion` handling. The **new** hero's entrance animation must gate on `useReducedMotion()` from `framer-motion` (same pattern as `components/ai/modern-chatbot/welcome-hero.tsx:104`) — this is a new requirement being introduced by this plan, not a pre-existing guarantee.
- No parallel route (`/landing-v2`), no new design-token/primitive files — everything lives in `app/landing/page.tsx` following its existing single-file, local-component-function pattern (`HeroGraph`, `FloatingNav`).
- Every task ends with `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit --incremental` showing no *new* errors beyond the pre-existing baseline (currently 70 — confirm the count doesn't increase, not that it hits zero).

---

### Task 1: Capture real screenshot + generate AI illustration (asset prep)

**Files:**
- Create: `public/landing/hero-ahora.png` (real screenshot)
- Create: `public/landing/hero-illustration.png` (AI-generated warm illustration)

**Interfaces:**
- Produces: two image files at the paths above. Task 4 (hero rewrite) references both by these exact paths. No other task depends on this one's output except Task 4.
- `hero-ahora.png` must be a clean crop of just the "Ahora →" hero card (`components/dashboard/now-hero.tsx`), not the full dashboard chrome around it — the hero section will present it as a floating card, not a full-screen screenshot.

- [ ] **Step 1: Capture the real "Ahora →" screenshot**

Use the `agent-browser` skill against this session's existing dogfooding login (same account used for the prior visual-audit dogfooding pass). Navigate to the authenticated dashboard, wait for the "Ahora →" hero card (`components/dashboard/now-hero.tsx`) to render with real data (not a loading skeleton), and capture a cropped screenshot of just that card at a clean size (target ~1200px wide, consistent 2:1–ish aspect ratio so it composes well in a hero layout). Save to `public/landing/hero-ahora.png`.

- [ ] **Step 2: Generate the AI warm illustration**

Generate a warm, calm illustration (a person in a focused/calm moment — soft light, muted warm tones matching `#FBF6EF` background / `#E2703F` accent) suitable as a subtle hero background element (it must work at low opacity behind foreground text and the product screenshot — avoid busy detail or high contrast that would compete with the product shot in front of it). Save to `public/landing/hero-illustration.png`.

- [ ] **Step 3: Verify both files exist and are reasonable**

Run: `ls -la public/landing/hero-ahora.png public/landing/hero-illustration.png`
Expected: both files present, each under 500KB (optimize/compress if larger — Next.js `<Image>` will still process them, but a bloated source file slows the build).

- [ ] **Step 4: Commit**

```bash
git add public/landing/hero-ahora.png public/landing/hero-illustration.png
git commit -m "assets: real Ahora screenshot + AI hero illustration for landing redesign"
```

---

### Task 2: Palette foundation — root container, nav, footer

**Files:**
- Modify: `app/landing/page.tsx:126-171` (`FloatingNav`)
- Modify: `app/landing/page.tsx:173-190` (root `LandingPage` container open)
- Modify: `app/landing/page.tsx:475-486` (footer)

**Interfaces:**
- Produces: the palette tokens every later task reuses verbatim:
  - Background: `#FBF6EF`
  - Text (primary): `#241F19`
  - Card fill (glass): `bg-[#241F19]/[0.03]`
  - Card border (glass): `border-[#241F19]/[0.08]`
  - Card hover border: `border-[#241F19]/[0.18]`
  - Warm hover shadow: `boxShadow: '0 20px 50px rgba(36,31,25,0.12)'`
  - Indigo stays literally unchanged: `#6366f1` / `rgba(99,102,241,*)` everywhere it already appears.
- Consumes: nothing from other tasks.

- [ ] **Step 1: Restyle the root container**

In `app/landing/page.tsx`, change the root div (currently `className="h-dvh w-full bg-[#050505] text-white overflow-y-auto overflow-x-hidden custom-scrollbar"`) to:

```tsx
    <div
      ref={scrollRef}
      className="h-dvh w-full bg-[#FBF6EF] text-[#241F19] overflow-y-auto overflow-x-hidden custom-scrollbar"
      // Landing is a fixed-brand marketing surface — pin --primary to the Novo
      // indigo so it never inherits the user's in-app accent (e.g. orange),
      // which SettingsProvider writes onto :root globally.
      style={{
        ['--primary' as string]: '#6366f1',
        ['--primary-rgb' as string]: '99, 102, 241',
        ['--primary-glow' as string]: 'rgba(99,102,241,0.5)',
        ['--ring' as string]: '#6366f1',
      } as React.CSSProperties}
    >
```

(Only the `className` background/text colors changed — the CSS var block for indigo is untouched, per the Global Constraints.)

- [ ] **Step 2: Restyle `FloatingNav`**

Replace the `motion.nav` className ternary (`app/landing/page.tsx:143-147`):

```tsx
        className={
          scrolled
            ? 'max-w-5xl border border-[#241F19]/[0.09] bg-[#FBF6EF]/80 backdrop-blur-2xl shadow-[0_16px_50px_rgba(36,31,25,0.12)]'
            : 'max-w-7xl border-b border-[#241F19]/[0.08] bg-[#FBF6EF]/90 backdrop-blur-xl'
        }
```

And the two text/link colors inside it (`app/landing/page.tsx:157,160`) from `text-white/60 hover:text-white` to `text-[#241F19]/60 hover:text-[#241F19]`. The `Button` component and its indigo shadow glow (`shadow-[0_0_20px_rgba(99,102,241,0.35)]`) are unchanged.

- [ ] **Step 3: Restyle the footer**

In `app/landing/page.tsx:476-483`, change:

```tsx
      <footer className="border-t border-[#241F19]/[0.08]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between text-xs text-[#241F19]/50">
          <span>© {new Date().getFullYear()} Novo · Cognitive Operating System</span>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-[#241F19] transition-colors">Privacidad</Link>
            <Link href="/terms" className="hover:text-[#241F19] transition-colors">Condiciones</Link>
            <Link href="/auth/signin" className="hover:text-[#241F19] transition-colors">Iniciar sesión</Link>
          </div>
        </div>
      </footer>
```

- [ ] **Step 4: Typecheck**

Run: `cd "novo-desktop-mvp (2)" && NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit --incremental 2>&1 | grep -c "error TS"`
Expected: same count as the pre-existing baseline (check the count before this task's changes and confirm it hasn't grown).

- [ ] **Step 5: Manual visual check**

Run the dev server, load `/landing`, confirm: page background is cream, nav bar (both at top and scrolled states) reads as a light frosted bar, footer text is readable warm-dark-on-cream. (The hero and content sections will still look broken/mismatched at this point — that's expected, they're restyled in later tasks.)

- [ ] **Step 6: Commit**

```bash
git add app/landing/page.tsx
git commit -m "style(landing): warm/light palette for root container, nav, and footer"
```

---

### Task 3: Delete the 3D graph hero component

**Files:**
- Delete: `components/landing/hero-graph-3d.tsx`
- Modify: `app/landing/page.tsx:1-27` (imports + `HeroGraph3D` dynamic import)

**Interfaces:**
- Consumes: nothing.
- Produces: removal of the `HeroGraph3D` and `HeroGraph` (SVG fallback, `app/landing/page.tsx:64-124`) symbols — Task 4 must not reference either name.

- [ ] **Step 1: Delete the component file**

```bash
rm components/landing/hero-graph-3d.tsx
```

- [ ] **Step 2: Remove the dynamic import and its comment block**

Delete lines 16-27 of `app/landing/page.tsx` (the `WebGL only for this one hero visual...` comment and the `const HeroGraph3D = dynamic(...)` block) and the `dynamic` import on line 6 (`import dynamic from 'next/dynamic'`) — confirm `dynamic` isn't used anywhere else in this file before removing the import (it currently is not).

- [ ] **Step 3: Remove the `HeroGraph` SVG fallback function**

Delete the entire `function HeroGraph() { ... }` block (`app/landing/page.tsx:64-124`) and the `NODE_COLOR` constant above it (`app/landing/page.tsx:33-39`) — both are only used by the now-deleted hero graph.

- [ ] **Step 4: Replace the dangling `<HeroGraph3D />` JSX usage with a placeholder**

`app/landing/page.tsx:228` (inside the hero's `motion.div`) still reads `<HeroGraph3D />`, which no longer exists after Step 2. Task 4 replaces this entire hero section wholesale, so this task only needs to leave the file compiling in the meantime — replace that single line with a plain placeholder:

```tsx
<div className="w-full max-w-[440px] aspect-square mx-auto" />
```

Run: `grep -n "HeroGraph\|NODE_COLOR" app/landing/page.tsx`
Expected: no matches.

- [ ] **Step 5: Typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit --incremental 2>&1 | grep -c "error TS"`
Expected: same count as the pre-existing baseline — the file must compile cleanly at the end of this task.

- [ ] **Step 6: Commit**

```bash
git add -A components/landing/hero-graph-3d.tsx app/landing/page.tsx
git commit -m "refactor(landing): retire 3D neural-graph hero component"
```

---

### Task 4: New hero section

**Files:**
- Modify: `app/landing/page.tsx:192-281` (hero `<section>`)
- Modify: `app/landing/page.tsx` imports (add `useReducedMotion` from `framer-motion`, add `Image` usage if not already imported — `Image` is already imported at line 5)

**Interfaces:**
- Consumes: `public/landing/hero-ahora.png`, `public/landing/hero-illustration.png` from Task 1. Palette tokens from Task 2 (`#FBF6EF`, `#241F19`, indigo unchanged).
- Produces: nothing further downstream depends on hero internals — Task 5/6 only touch other sections.

- [ ] **Step 1: Replace the hero section**

Replace the entire hero `<section>` (`app/landing/page.tsx:195-281`, from `<section className="relative overflow-hidden">` through its closing `</section>`) with:

```tsx
      <section className="relative overflow-hidden">
        {/* Ghosted background wordmark — warm, barely-there texture */}
        <div className="absolute inset-x-0 top-[6%] flex justify-center pointer-events-none select-none z-0">
          <span className="text-[20vw] leading-none font-black tracking-tighter text-[#241F19]/[0.04] whitespace-nowrap">
            COGNITIVE
          </span>
        </div>
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[70%] h-[50%] rounded-full opacity-10 blur-[160px] pointer-events-none" style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }} />

        <div className="relative max-w-7xl mx-auto px-6 pt-14 pb-16">
          {/* Spec-sheet top row */}
          <div className="flex items-start justify-between text-[10px] font-bold tracking-[0.2em] uppercase text-[#241F19]/40 mb-8">
            <div className="space-y-0.5">
              <div>SEQ.001 / TWIN&nbsp;ONLINE</div>
              <div className="text-[#241F19]/20">República Dominicana · GMT-4</div>
            </div>
            <div className="text-right space-y-0.5">
              <div className="text-primary/70">OBSERVE → INTERPRET → PREDICT → GUIDE → LEARN</div>
              <div className="text-[#241F19]/20">Ciclo continuo, no una foto fija</div>
            </div>
          </div>

          {/* Dominant visual: real product screenshot floating over a soft
              AI-generated illustration, not the old 3D graph. */}
          <HeroVisual />

          <motion.div
            className="relative z-10 text-center px-4 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springConfig.gentle}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-black tracking-[0.25em] uppercase text-primary">Cognitive Operating System</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-light italic tracking-tight leading-[1.05] mb-6">
              Deja de organizar tareas.<br />
              <span className="not-italic font-semibold">Empieza a ejecutar con tu energía real.</span>
            </h1>
            <p className="text-base md:text-lg text-[#241F19]/70 max-w-xl mx-auto mb-8 leading-relaxed">
              Novo construye un <strong className="text-[#241F19] font-semibold">Gemelo Cognitivo</strong> a partir de tu comportamiento real
              para responder una sola pregunta: ¿qué deberías hacer ahora mismo?
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                asChild
                size="lg"
                className="text-base px-8 shadow-[0_0_30px_rgba(99,102,241,0.4)] hover:shadow-[0_0_44px_rgba(99,102,241,0.65)] hover:-translate-y-0.5"
              >
                <Link href="/auth/signup">
                  Empezar gratis <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <a href="#como-funciona" className="text-sm font-medium text-[#241F19]/60 hover:text-[#241F19] transition-colors">
                Ver cómo funciona ↓
              </a>
            </div>
          </motion.div>

          {/* Spec-sheet bottom row: pipeline tags + live status */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-8 pt-6 border-t border-[#241F19]/[0.08] text-[10px] font-bold tracking-[0.15em] uppercase text-[#241F19]/35">
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {PIPELINE.map((p) => (
                <span key={p.label}>+ {p.label}</span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-600/80">Tu Twin empieza a aprender desde hoy</span>
            </div>
          </div>
        </div>
      </section>
```

Note: `text-emerald-400/80` became `text-emerald-600/80` for the live-status line — the lighter emerald reads too washed-out against cream; the darker shade keeps it legible while staying visually a "status green."

- [ ] **Step 2: Add the `HeroVisual` component**

Add this new function above `FloatingNav` (where `HeroGraph`/`HeroGraph3D` used to be):

```tsx
function HeroVisual() {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      className="relative flex flex-col items-center justify-center py-4"
      initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={reduceMotion ? { duration: 0 } : { ...springConfig.gentle, delay: 0.1 }}
    >
      <div className="relative w-full max-w-2xl mx-auto">
        <Image
          src="/landing/hero-illustration.png"
          alt=""
          width={900}
          height={900}
          className="absolute inset-0 w-full h-full object-cover rounded-[2rem] opacity-25 pointer-events-none select-none"
          priority={false}
        />
        <div className="relative rounded-3xl border border-[#241F19]/[0.08] bg-[#FBF6EF]/70 backdrop-blur-xl shadow-[0_30px_90px_rgba(36,31,25,0.15)] overflow-hidden">
          <Image
            src="/landing/hero-ahora.png"
            alt="La tarjeta 'Ahora →' de Novo, mostrando la decisión real para hoy"
            width={1200}
            height={600}
            className="w-full h-auto"
            priority
          />
        </div>
      </div>
      <span className="mt-3 text-[10px] font-bold tracking-[0.2em] uppercase text-[#241F19]/25 select-none">
        Esto es lo que ves cada mañana
      </span>
    </motion.div>
  )
}
```

`alt=""` on the background illustration is deliberate — it's pure decoration behind a labeled foreground image, so it should be invisible to screen readers rather than described.

- [ ] **Step 3: Add the `useReducedMotion` import**

In the imports block (`app/landing/page.tsx:7`), change:

```tsx
import { motion, useScroll, useMotionValueEvent } from 'framer-motion'
```
to:
```tsx
import { motion, useScroll, useMotionValueEvent, useReducedMotion } from 'framer-motion'
```

- [ ] **Step 4: Typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit --incremental 2>&1 | grep -c "error TS"`
Expected: back to the pre-existing baseline count (no dangling `HeroGraph3D`/`HeroGraph` references left from Task 3).

- [ ] **Step 5: Manual visual check**

Load `/landing`, confirm: hero shows the real "Ahora →" screenshot in a floating card over a subtle warm illustration, headline/subhead/CTA read correctly on the cream background, and toggling OS-level "reduce motion" (or via browser devtools' rendering emulation) removes the entrance scale/fade animation without breaking layout.

- [ ] **Step 6: Commit**

```bash
git add app/landing/page.tsx
git commit -m "feat(landing): new hero with real product screenshot + AI illustration"
```

---

### Task 5: Restyle product-proof, reframe, cómo-funciona, and differentiators sections

**Files:**
- Modify: `app/landing/page.tsx:283-394` (four `<section>` blocks: product proof, reframe, cómo funciona, differentiators)

**Interfaces:**
- Consumes: palette tokens from Task 2.
- Produces: nothing downstream depends on these specifically.

- [ ] **Step 1: Restyle the product-proof section**

In the section starting `{/* ── Product proof ── */}` (`app/landing/page.tsx:283-308`):
- `text-white/30` (label) → `text-[#241F19]/35`
- `border-white/10` (card border) → `border-[#241F19]/10`
- `shadow-[0_40px_120px_rgba(0,0,0,0.5)]` → `shadow-[0_40px_120px_rgba(36,31,25,0.18)]`
- `whileHover={{ transform: 'scale(1.01)', borderColor: 'rgba(99,102,241,0.35)' }}` — unchanged (indigo hover accent stays)
- Browser-chrome bar: `bg-[#0a0a0a] border-b border-white/[0.06]` → `bg-[#241F19]/[0.04] border-b border-[#241F19]/[0.08]`; the three dot spans `bg-white/10` → `bg-[#241F19]/15`; URL text `text-white/25` → `text-[#241F19]/40`

- [ ] **Step 2: Restyle the reframe section**

In `{/* ── Reframe ── */}` (`app/landing/page.tsx:311-339`):
- "Antes" card: `border-white/[0.08] bg-white/[0.03]` → `border-[#241F19]/[0.08] bg-[#241F19]/[0.03]`; hover `borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.045)'` → `borderColor: 'rgba(36,31,25,0.18)', backgroundColor: 'rgba(36,31,25,0.045)'`; label `text-white/45` → `text-[#241F19]/50`; body `text-white/70` → `text-[#241F19]/70`
- "Con Novo" card: `border-primary/30 bg-primary/[0.07]` unchanged (indigo tint, already works on light); label `text-indigo-300` → `text-indigo-700` (light-mode-legible shade); body `text-white` → `text-[#241F19]`, inner `<span className="font-semibold text-white">` → `text-[#241F19]`

- [ ] **Step 3: Restyle the cómo-funciona section**

In `{/* ── How it works ── */}` (`app/landing/page.tsx:342-368`):
- Label `text-primary` unchanged; heading `text-3xl md:text-4xl font-semibold` unchanged (inherits root text color, now `#241F19`); subtext `text-white/55` → `text-[#241F19]/60`
- Card: `border-white/[0.08] bg-white/[0.03]` → `border-[#241F19]/[0.08] bg-[#241F19]/[0.03]`; hover `borderColor: 'rgba(99,102,241,0.4)', boxShadow: '0 20px 50px rgba(99,102,241,0.15)'` unchanged (indigo hover accent stays on these interactive cards, per Global Constraints); label `text-white/90` → `text-[#241F19]/90`; detail `text-white/55` → `text-[#241F19]/60`

- [ ] **Step 4: Restyle the differentiators section**

In `{/* ── Differentiation ── */}` (`app/landing/page.tsx:371-394`):
- Same card treatment as Step 3 above: `border-white/[0.08] bg-white/[0.03]` → `border-[#241F19]/[0.08] bg-[#241F19]/[0.03]`, hover indigo accent unchanged, title `text-white` → `text-[#241F19]`, detail `text-white/55` → `text-[#241F19]/60`

- [ ] **Step 5: Typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit --incremental 2>&1 | grep -c "error TS"`
Expected: unchanged from baseline (pure className/style-object edits, no type surface touched).

- [ ] **Step 6: Manual visual check**

Load `/landing`, scroll through these four sections, confirm: all card text is legible warm-dark-on-cream, indigo hover glows still read clearly against the lighter background, no leftover `text-white`/`bg-white` classes produce invisible (white-on-cream) text — grep the four section ranges for `text-white` / `bg-white` to confirm none remain outside the two `Con Novo` / indigo-branded spots handled in Step 2.

Run: `sed -n '283,394p' app/landing/page.tsx | grep -n "text-white\|bg-white"`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add app/landing/page.tsx
git commit -m "style(landing): warm palette for product-proof, reframe, how-it-works, and differentiators sections"
```

---

### Task 6: Restyle pricing, final CTA, and add Lenis smooth scroll

**Files:**
- Modify: `app/landing/page.tsx:397-473` (pricing + final CTA sections)
- Modify: `app/landing/page.tsx:173-190` and `486` (wrap content in `SmoothScrollProvider`)
- Modify: `app/landing/page.tsx` imports (add `SmoothScrollProvider`)

**Interfaces:**
- Consumes: palette tokens from Task 2; `useLenis`/`SmoothScrollProvider` from `components/smooth-scroll-provider.tsx` (existing, used verbatim — same integration pattern as `components/app-sidebar.tsx:262`, `<SmoothScrollProvider scrollRef={...}>`).
- Produces: nothing downstream.

- [ ] **Step 1: Restyle the pricing section**

In `{/* ── Pricing ── */}` (`app/landing/page.tsx:397-451`):
- Heading/subtext: `text-white/50` → `text-[#241F19]/55`
- Free card: `border-white/[0.08] bg-white/[0.03]` → `border-[#241F19]/[0.08] bg-[#241F19]/[0.03]`; `text-white` (plan name/price) → `text-[#241F19]`; `text-white/45` (subtitle) → `text-[#241F19]/50`; feature check icon `text-white/30` → `text-[#241F19]/35`; feature text `text-white/60` → `text-[#241F19]/65`; outline button `border-white/15 hover:bg-white/5` → `border-[#241F19]/20 hover:bg-[#241F19]/5`
- Pro card: `border-primary/30 bg-primary/[0.06]` unchanged; `text-white` (plan name/price) → `text-[#241F19]`; `text-white/45` → `text-[#241F19]/50`; feature text `text-white/70` → `text-[#241F19]/75` (check icon stays `text-primary`); indigo CTA button glow unchanged

- [ ] **Step 2: Restyle the final CTA section**

In `{/* ── Final CTA ── */}` (`app/landing/page.tsx:454-473`):
- Radial glow: `opacity-20 blur-[140px]` → `opacity-10 blur-[140px]` (same indigo color, much lower opacity so it doesn't muddy the cream)
- Heading: no explicit color class today (inherits root `text-white`, now inherits `#241F19` automatically) — no change needed
- Subtext `text-white/55` → `text-[#241F19]/60`
- CTA button glow unchanged (indigo)

- [ ] **Step 3: Wrap page content in `SmoothScrollProvider`**

Add the import (`app/landing/page.tsx`, alongside the other component imports):

```tsx
import { SmoothScrollProvider } from '@/components/smooth-scroll-provider'
```

Change the return statement's structure so everything between the root scroll div's open tag and its closing `</div>` is wrapped in a single child div inside `SmoothScrollProvider` (Lenis requires exactly one direct child of the scroll wrapper — see `components/smooth-scroll-provider.tsx:47`, `content: wrapper.firstElementChild`):

```tsx
      style={{
        ['--primary' as string]: '#6366f1',
        ['--primary-rgb' as string]: '99, 102, 241',
        ['--primary-glow' as string]: 'rgba(99,102,241,0.5)',
        ['--ring' as string]: '#6366f1',
      } as React.CSSProperties}
    >
      <SmoothScrollProvider scrollRef={scrollRef}>
        <div>
          <FloatingNav scrollRef={scrollRef} />

          {/* ...all existing sections (hero through footer) go here, unchanged by this step... */}

        </div>
      </SmoothScrollProvider>
    </div>
  )
}
```

Concretely: insert `<SmoothScrollProvider scrollRef={scrollRef}>` and an opening `<div>` immediately after the root div's opening tag (right before `<FloatingNav scrollRef={scrollRef} />`), and insert the matching closing `</div>` and `</SmoothScrollProvider>` immediately before the root div's closing `</div>` (right after `</footer>`). Everything else in the file is unindented/reindented but otherwise untouched.

- [ ] **Step 4: Typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit --incremental 2>&1 | grep -c "error TS"`
Expected: unchanged from baseline. `SmoothScrollProvider`'s `scrollRef` prop accepts `RefObject<HTMLElement | null>` — `app-sidebar.tsx` already passes a `RefObject<HTMLDivElement>` the same way, so this is a proven-compatible pattern.

- [ ] **Step 5: Manual visual check**

Load `/landing`, confirm: pricing cards and final CTA read correctly on cream, scrolling feels smooth/lerped (Lenis is active) rather than the browser's native instant scroll, and the `FloatingNav`'s scroll-triggered shrink animation (`app/landing/page.tsx:127-132`, `useScroll({ container: scrollRef })`) still fires correctly — Lenis dispatches native scroll events on its wrapper, so this should keep working unmodified, but confirm visually since it's the one interaction most likely to break from the wrapper-div change.

- [ ] **Step 6: Commit**

```bash
git add app/landing/page.tsx
git commit -m "style(landing): warm palette for pricing/CTA sections, add Lenis smooth scroll"
```

---

### Task 7: Full verification pass and final cleanup

**Files:** none (verification only, plus fixing anything it surfaces)

**Interfaces:** none.

- [ ] **Step 1: Full typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit --incremental 2>&1 | tee /tmp/tsc_final.txt | grep -c "error TS"`
Expected: exactly the pre-existing baseline count, with zero errors in `app/landing/page.tsx` or `components/smooth-scroll-provider.tsx`:
Run: `grep -E "app/landing/page\.tsx|components/smooth-scroll-provider\.tsx" /tmp/tsc_final.txt`
Expected: no output.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build succeeds, `/landing` appears in the route list as before (static or dynamic, matching its current build output).

- [ ] **Step 3: agent-browser QA pass — desktop**

Use `agent-browser` to load `/landing` at a desktop viewport (~1440×900). Confirm: no horizontal overflow/scrollbar, hero screenshot and illustration both load (no broken-image icons), all section text is legible (no white-on-cream invisible text), Lenis smooth scroll is active, `FloatingNav` shrinks correctly on scroll, all CTA buttons link to `/auth/signup` and `/auth/signin` as before.

- [ ] **Step 4: agent-browser QA pass — mobile**

Use `agent-browser` to load `/landing` at a mobile viewport (~390×844). Confirm: no horizontal overflow, hero stacks cleanly, pricing cards stack to a single column, footer links remain reachable and tappable.

- [ ] **Step 5: Reduced-motion check**

Use `agent-browser`'s reduced-motion emulation (or browser devtools' "Emulate CSS prefers-reduced-motion: reduce") on `/landing`. Confirm the hero's entrance animation (Task 4's `HeroVisual`) is skipped per the `useReducedMotion` gate, and no other animation on the page becomes janky or broken as a result (only the hero's entrance was gated by this plan — other hover/scroll animations are expected to still animate, since gating every existing hover transition was explicitly out of scope).

- [ ] **Step 6: Fix anything surfaced by Steps 1-5**

If any check fails, fix it directly in `app/landing/page.tsx` (or the relevant file) and re-run the failing check until it passes. Do not proceed to Step 7 with a known failure.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "chore(landing): verification pass for warm redesign"
```

(Only commit if Step 6 produced fixes — if all checks passed clean on the first pass, there's nothing to commit here and this step is skipped.)
