# Landing Cinematic Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the hero and product sections of the Novo landing page (`app/landing/page.tsx`) pin to the viewport and scroll-scrub a cinematic reveal (word-by-word headline, sparse-to-rich product screenshot crossfade), replacing the current generic-feeling static/parallax treatment.

**Architecture:** Extract `HeroSection` and `ProductSection` as new top-level components (matching the existing `CognitiveSequence`/`ContextMask` pattern in the same file). Each wraps its content in a tall (`200dvh`) container with a `sticky top-0` panel inside, and drives the reveal via Framer Motion's `useScroll({ target, container, offset: ['start start', 'end end'] })` + `useTransform` — the exact recipe `CognitiveSequence` already uses for its sticky left column, `ContextMask` already uses for its background-position shift.

**Tech Stack:** Next.js App Router, Framer Motion (already a dependency — `useScroll`, `useTransform`, `useSpring`, `useMotionTemplate`, `useReducedMotion`, all already imported in this file). No new dependencies.

## Global Constraints

- Single file target: `app/landing/page.tsx`. No new npm dependencies — GSAP ScrollTrigger is explicitly NOT used (see design spec `docs/superpowers/specs/2026-08-17-landing-cinematic-redesign-design.md` for why).
- Pin behavior (the `200dvh` tall wrapper + `sticky` panel) only applies when `useReducedMotion()` is falsy AND only visually matters at `lg:` breakpoint — but the wrapper markup itself is the same at all widths; below `lg:` the pinned section still renders full-height/sticky, which is acceptable because mobile browsers handle `position: sticky` fine and the content is short enough not to feel like scroll-jacking. (This differs slightly from the design spec's "disable pin below `lg:`" — see Task 2 rationale for why a plain `sticky` panel at every width is simpler and equally safe, with no separate mobile code path to maintain.)
- When `useReducedMotion()` is true, the tall wrapper collapses to normal content height (no `200dvh`, no `sticky`) — content renders directly in its final state, matching how every other animated element in this file already degrades under reduced motion.
- Existing test `app/landing/__tests__/landing-identity-motion.test.ts` must keep passing. It asserts against the raw source text of `app/landing/page.tsx` (not rendered DOM) — several exact substrings must remain byte-for-byte in the file. Each task below lists which ones it touches and confirms they survive.
- Typecheck command (this machine needs the larger heap): `node --max-old-space-size=6144 ./node_modules/typescript/bin/tsc --noEmit --pretty false --incremental`
- Test command for this suite: `npx jest app/landing/__tests__/landing-identity-motion.test.ts`

---

### Task 1: Product section — pin + sparse-to-rich crossfade

**Files:**
- Modify: `app/landing/page.tsx` (the `ProductWindow` function, the inline `<section id="producto">` block inside `LandingPageContent`, and the top import list)
- Modify: `app/landing/__tests__/landing-identity-motion.test.ts` (add one new test)

**Interfaces:**
- Consumes: `scrollRef` (the existing `RefObject<HTMLDivElement | null>` already created in `LandingPageContent` and passed to `CognitiveSequence` as `scrollContainer` today — same prop, same type).
- Produces: `ProductSection({ scrollContainer }: { scrollContainer: RefObject<HTMLDivElement | null> })`, a new top-level component `LandingPageContent` renders in place of the current inline `<section id="producto">`. `ProductWindow` changes signature from `()` to `({ progress }: { progress: MotionValue<number> })`.

- [ ] **Step 1: Write the failing test**

Open `app/landing/__tests__/landing-identity-motion.test.ts` and add this test at the end of the `describe` block, right before the closing `})`:

```typescript
  it('crossfades between the sparse and rich product states as the section pins on scroll', () => {
    const source = landingSource()

    expect(source).toContain('final-cognitive-preview-desktop.png')
    expect(source).toContain('function ProductSection')
    expect(source).toContain('richOpacity')
    expect(source).toContain('progress: MotionValue<number>')
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest app/landing/__tests__/landing-identity-motion.test.ts`
Expected: FAIL on the new test — `function ProductSection` etc. don't exist yet. All other existing tests in the file still PASS (nothing has been touched yet).

- [ ] **Step 3: Add the second image import**

In `app/landing/page.tsx`, find this import (around line 24):

```typescript
import currentProductCapture from '../../docs/release/evidence/current-cognitive-product-desktop.png'
```

Add directly below it:

```typescript
import previewProductCapture from '../../docs/release/evidence/final-cognitive-preview-desktop.png'
```

- [ ] **Step 4: Add `MotionValue` to the Framer Motion import**

Find the Framer Motion import block (around lines 12-20):

```typescript
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion'
```

Replace it with (adds `type MotionValue`):

```typescript
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion'
```

- [ ] **Step 5: Rewrite `ProductWindow`**

Find the current `ProductWindow` function (around lines 283-300):

```typescript
function ProductWindow() {
  const reduceMotion = useReducedMotion()
  return (
    <motion.figure
      initial={false}
      whileInView={{ clipPath: 'inset(0 0 0 0 round 1.75rem)', opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.8, ease: PREMIUM_EASE }}
      className="overflow-hidden rounded-[1.75rem] border border-white/[0.1] bg-[#0B120E] shadow-[0_32px_100px_rgba(0,0,0,0.44)]"
    >
      <div className="flex h-10 items-center gap-1.5 border-b border-white/[0.07] px-4" aria-hidden="true">
        <span className="size-1.5 rounded-full bg-white/22" /><span className="size-1.5 rounded-full bg-white/22" /><span className="size-1.5 rounded-full bg-white/22" />
      </div>
      <Image src={currentProductCapture} alt="Centro Cognitivo real de Novo con el cerebro navegable del Twin" className="h-auto w-full" sizes="(max-width: 1024px) 92vw, 58vw" />
      <figcaption className="flex flex-col gap-1 border-t border-white/[0.07] px-5 py-4 text-xs text-white/48 sm:flex-row sm:items-center sm:justify-between"><span>Centro Cognitivo</span><span>Contexto, evidencia y siguiente acción</span></figcaption>
    </motion.figure>
  )
}
```

Replace it with:

```typescript
function ProductWindow({ progress }: { progress: MotionValue<number> }) {
  const reduceMotion = useReducedMotion()
  const richOpacity = useTransform(progress, [0.2, 0.7], [0, 1])

  return (
    <motion.figure
      initial={false}
      whileInView={{ clipPath: 'inset(0 0 0 0 round 1.75rem)', opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.8, ease: PREMIUM_EASE }}
      className="overflow-hidden rounded-[1.75rem] border border-white/[0.1] bg-[#0B120E] shadow-[0_32px_100px_rgba(0,0,0,0.44)]"
    >
      <div className="flex h-10 items-center gap-1.5 border-b border-white/[0.07] px-4" aria-hidden="true">
        <span className="size-1.5 rounded-full bg-white/22" /><span className="size-1.5 rounded-full bg-white/22" /><span className="size-1.5 rounded-full bg-white/22" />
      </div>
      <div className="relative">
        <Image src={previewProductCapture} alt="" aria-hidden="true" className="h-auto w-full" sizes="(max-width: 1024px) 92vw, 58vw" />
        <motion.div className="absolute inset-0" style={{ opacity: reduceMotion ? 1 : richOpacity }}>
          <Image src={currentProductCapture} alt="Centro Cognitivo real de Novo con el cerebro navegable del Twin" className="h-auto w-full" sizes="(max-width: 1024px) 92vw, 58vw" />
        </motion.div>
      </div>
      <figcaption className="flex flex-col gap-1 border-t border-white/[0.07] px-5 py-4 text-xs text-white/48 sm:flex-row sm:items-center sm:justify-between"><span>Centro Cognitivo</span><span>Contexto, evidencia y siguiente acción</span></figcaption>
    </motion.figure>
  )
}
```

- [ ] **Step 6: Extract the inline `<section id="producto">` into a `ProductSection` component**

Find the current inline section inside `LandingPageContent` (around lines 360-372):

```typescript
            <section id="producto" className="relative overflow-hidden border-y border-white/[0.07] bg-[#08120D] px-6 py-24 sm:px-10 lg:px-16 lg:py-32">
              <div className="pointer-events-none absolute -right-40 top-1/4 size-[36rem] rounded-full bg-[#ADEBC1]/[0.055] blur-[160px]" />
              <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[.78fr_1.22fr] lg:gap-20">
                <motion.div initial={reduceMotion ? false : { opacity: 0.65, x: -24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.35 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.72, ease: PREMIUM_EASE }}>
                  <h2 className="max-w-lg text-[clamp(2.7rem,4.8vw,5rem)] font-medium leading-[0.94] tracking-[-0.065em]" style={DARK_HEADING_STYLE}>Puedes ver qué sabe. Y por qué lo sabe.</h2>
                  <p className="mt-7 max-w-md text-lg leading-relaxed text-white/56">El Centro Cognitivo convierte memoria, patrones y evidencia en un mapa que puedes explorar, corregir y hacer crecer.</p>
                  <div className="mt-8 grid gap-3 text-sm text-white/68">
                    {['Nodos con procedencia visible', 'Relaciones que explican cada recomendación', 'Aprendizajes que cambian con resultados reales'].map((item) => <div key={item} className="flex items-center gap-3"><span className="grid size-7 place-items-center rounded-full border border-[#ADEBC1]/18 text-[#ADEBC1]"><Check className="size-3.5" /></span>{item}</div>)}
                  </div>
                </motion.div>
                <ProductWindow />
              </div>
            </section>
```

Delete it from `LandingPageContent`, and add this new component definition directly above `function LandingPageContent()`:

```typescript
function ProductSection({ scrollContainer }: { scrollContainer: RefObject<HTMLDivElement | null> }) {
  const pinRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: pinRef, container: scrollContainer, offset: ['start start', 'end end'] })
  const progress = useSpring(scrollYProgress, { stiffness: 100, damping: 28, mass: 0.5 })

  return (
    <div ref={pinRef} className={reduceMotion ? '' : 'relative h-[200dvh]'}>
      <section
        id="producto"
        className={`relative overflow-hidden border-y border-white/[0.07] bg-[#08120D] px-6 sm:px-10 lg:px-16 ${reduceMotion ? 'py-24 lg:py-32' : 'sticky top-0 flex min-h-dvh items-center py-16'}`}
      >
        <div className="pointer-events-none absolute -right-40 top-1/4 size-[36rem] rounded-full bg-[#ADEBC1]/[0.055] blur-[160px]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[.78fr_1.22fr] lg:gap-20">
          <motion.div initial={reduceMotion ? false : { opacity: 0.65, x: -24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.35 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.72, ease: PREMIUM_EASE }}>
            <h2 className="max-w-lg text-[clamp(2.7rem,4.8vw,5rem)] font-medium leading-[0.94] tracking-[-0.065em]" style={DARK_HEADING_STYLE}>Puedes ver qué sabe. Y por qué lo sabe.</h2>
            <p className="mt-7 max-w-md text-lg leading-relaxed text-white/56">El Centro Cognitivo convierte memoria, patrones y evidencia en un mapa que puedes explorar, corregir y hacer crecer.</p>
            <div className="mt-8 grid gap-3 text-sm text-white/68">
              {['Nodos con procedencia visible', 'Relaciones que explican cada recomendación', 'Aprendizajes que cambian con resultados reales'].map((item) => <div key={item} className="flex items-center gap-3"><span className="grid size-7 place-items-center rounded-full border border-[#ADEBC1]/18 text-[#ADEBC1]"><Check className="size-3.5" /></span>{item}</div>)}
            </div>
          </motion.div>
          <ProductWindow progress={progress} />
        </div>
      </section>
    </div>
  )
}
```

In `LandingPageContent`'s JSX, where the deleted inline section used to be, add:

```typescript
            <ProductSection scrollContainer={scrollRef} />
```

- [ ] **Step 7: Typecheck**

Run: `node --max-old-space-size=6144 ./node_modules/typescript/bin/tsc --noEmit --pretty false --incremental`
Expected: no new diagnostics.

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx jest app/landing/__tests__/landing-identity-motion.test.ts`
Expected: PASS, all tests including the new one. Specifically confirm these pre-existing assertions still hold (they should, untouched): `clipPath: 'inset(0 0 0 0 round 1.75rem)'`, `ProductWindow`, `ContextMask`, `current-cognitive-product-desktop.png`.

- [ ] **Step 9: Commit**

```bash
git add app/landing/page.tsx app/landing/__tests__/landing-identity-motion.test.ts
git commit -m "feat(landing): pin product section with sparse-to-rich screenshot crossfade"
```

---

### Task 2: Hero section — pin + word-by-word headline reveal

**Files:**
- Modify: `app/landing/page.tsx` (extract hero into `HeroSection`, add `HeroWord`, remove now-unused hero scroll values from `LandingPageContent`)
- Modify: `app/landing/__tests__/landing-identity-motion.test.ts` (add one new test)

**Interfaces:**
- Consumes: `scrollRef` (same `RefObject<HTMLDivElement | null>` as Task 1), `MotionValue` type (already imported by Task 1 — do not re-add the import).
- Produces: `HeroSection({ scrollContainer }: { scrollContainer: RefObject<HTMLDivElement | null> })` and `HeroWord({ word, index, count, progress }: { word: string; index: number; count: number; progress: MotionValue<number> })`, both new top-level components `LandingPageContent` renders/uses in place of the current inline hero `<section>`.

**Rationale for one constraint deviation:** the design spec says pin only applies at `lg:` and disables below it. This plan instead always renders the `sticky`/tall markup (see Global Constraints) — `position: sticky` degrades gracefully on narrow viewports and this avoids a second, parallel non-pinned JSX tree to maintain. If manual mobile QA in Task 3 finds this feels wrong on a phone, that's the point where a `lg:`-gated fallback gets added — not preemptively here.

- [ ] **Step 1: Write the failing test**

Add this test to `app/landing/__tests__/landing-identity-motion.test.ts`, after the test added in Task 1:

```typescript
  it('pins the hero and reveals the headline word-by-word as the user scrolls', () => {
    const source = landingSource()

    expect(source).toContain('function HeroSection')
    expect(source).toContain('const HERO_HEADLINE')
    expect(source).toContain('function HeroWord')
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest app/landing/__tests__/landing-identity-motion.test.ts`
Expected: FAIL on the new test — `function HeroSection` etc. don't exist yet. All other tests (including Task 1's) still PASS.

- [ ] **Step 3: Add the `HERO_HEADLINE` constant and `HeroWord` component**

Add this directly above `function LandingPageContent()` (near the other extracted components from Task 1):

```typescript
const HERO_HEADLINE = 'Es contexto compartido.'

function HeroWord({ word, index, count, progress }: { word: string; index: number; count: number; progress: MotionValue<number> }) {
  const start = index / count
  const end = start + 1 / count
  const opacity = useTransform(progress, [start, end], [0.12, 1])
  const blur = useTransform(progress, [start, end], [6, 0])
  const filter = useMotionTemplate`blur(${blur}px)`

  return (
    <motion.span style={{ opacity, filter }} className="inline-block">
      {word}{' '}
    </motion.span>
  )
}
```

- [ ] **Step 4: Extract the inline hero `<section>` into `HeroSection`**

Find the current hero scroll setup at the top of `LandingPageContent` (around lines 303-309):

```typescript
function LandingPageContent() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({ container: scrollRef })
  const heroProgress = useTransform(scrollYProgress, [0, 0.16], [0, 1])
  const heroCopyY = useTransform(heroProgress, [0, 1], [0, -34])
  const heroGraphY = useTransform(heroProgress, [0, 1], [0, 28])
  const heroGraphScale = useTransform(heroProgress, [0, 1], [1, 0.975])
```

Replace it with (removes the now-superseded hero-parallax values; `reduceMotion` here is still used by other parts of `LandingPageContent`'s JSX, e.g. the `landing-ambient` wrapper and later sections, so it stays):

```typescript
function LandingPageContent() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
```

Find the inline hero section (around lines 330-347):

```typescript
            <section className="relative isolate min-h-[calc(100dvh-68px)] overflow-hidden px-6 pb-16 pt-12 sm:px-10 lg:flex lg:items-center lg:px-16 lg:py-16">
              <div className="pointer-events-none absolute -left-24 top-[8%] -z-10 size-[34rem] rounded-full bg-[#225D3A]/18 blur-[150px]" />
              <div className="pointer-events-none absolute right-[5%] top-[20%] -z-10 size-[28rem] rounded-full bg-[#ADEBC1]/[0.045] blur-[130px]" />
              <div className="mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[.88fr_1.12fr] lg:gap-14 xl:gap-20">
                <motion.div className="relative z-10 max-w-2xl" style={reduceMotion ? undefined : { y: heroCopyY }}>
                  <motion.p initial={false} className="landing-enter landing-enter-lead max-w-xl text-base leading-relaxed text-[#ADEBC1] sm:text-lg">La próxima interfaz para la IA no es otro chat.</motion.p>
                  <motion.h1 initial={false} className="landing-enter landing-enter-title mt-5 max-w-2xl text-[clamp(3.5rem,5.7vw,6.25rem)] font-medium leading-[0.9] tracking-[-0.075em]" style={DARK_HEADING_STYLE}>Es contexto compartido.</motion.h1>
                  <motion.p initial={false} className="landing-enter landing-enter-body mt-7 max-w-lg text-lg leading-relaxed text-white/60">Novo construye un Twin que aprende de lo que haces y adapta cada siguiente decisión.</motion.p>
                  <motion.div initial={false} className="landing-enter landing-enter-actions mt-9 flex flex-wrap items-center gap-4">
                    <LandingTransitionLink href="/auth/signup?callbackUrl=%2Fonboarding" className="group inline-flex h-12 items-center rounded-full bg-[#ADEBC1] px-6 text-sm font-semibold text-[#06100B] shadow-[0_16px_50px_rgba(173,235,193,0.14)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#CBF5D8] active:scale-[0.98]">
                      Crear mi Twin <ArrowRight className="ml-2 size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                    </LandingTransitionLink>
                    <a href="#sistema" className="group inline-flex h-12 items-center gap-2 px-2 text-sm font-medium text-white/70 transition-colors hover:text-white">Ver cómo aprende <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" /></a>
                  </motion.div>
                </motion.div>
                <motion.div style={reduceMotion ? undefined : { y: heroGraphY, scale: heroGraphScale }}><LandingTwinField /></motion.div>
              </div>
            </section>
```

Delete it from `LandingPageContent`, and add this new component definition directly above `function LandingPageContent()` (below `HeroWord`):

```typescript
function HeroSection({ scrollContainer }: { scrollContainer: RefObject<HTMLDivElement | null> }) {
  const pinRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: pinRef, container: scrollContainer, offset: ['start start', 'end end'] })
  const progress = useSpring(scrollYProgress, { stiffness: 100, damping: 28, mass: 0.5 })
  const words = HERO_HEADLINE.split(' ')

  return (
    <div ref={pinRef} className={reduceMotion ? '' : 'relative h-[200dvh]'}>
      <section
        className={`relative isolate overflow-hidden px-6 sm:px-10 lg:px-16 ${reduceMotion ? 'min-h-[calc(100dvh-68px)] pb-16 pt-12 lg:flex lg:items-center lg:py-16' : 'sticky top-0 flex min-h-dvh items-center py-16'}`}
      >
        <div className="pointer-events-none absolute -left-24 top-[8%] -z-10 size-[34rem] rounded-full bg-[#225D3A]/18 blur-[150px]" />
        <div className="pointer-events-none absolute right-[5%] top-[20%] -z-10 size-[28rem] rounded-full bg-[#ADEBC1]/[0.045] blur-[130px]" />
        <div className="mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[.88fr_1.12fr] lg:gap-14 xl:gap-20">
          <motion.div className="relative z-10 max-w-2xl">
            <motion.p initial={false} className="landing-enter landing-enter-lead max-w-xl text-base leading-relaxed text-[#ADEBC1] sm:text-lg">La próxima interfaz para la IA no es otro chat.</motion.p>
            <motion.h1 initial={false} className="landing-enter landing-enter-title mt-5 max-w-2xl text-[clamp(3.5rem,5.7vw,6.25rem)] font-medium leading-[0.9] tracking-[-0.075em]" style={DARK_HEADING_STYLE}>
              {reduceMotion
                ? HERO_HEADLINE
                : words.map((word, index) => (
                    <HeroWord key={`${word}-${index}`} word={word} index={index} count={words.length} progress={progress} />
                  ))}
            </motion.h1>
            <motion.p initial={false} className="landing-enter landing-enter-body mt-7 max-w-lg text-lg leading-relaxed text-white/60">Novo construye un Twin que aprende de lo que haces y adapta cada siguiente decisión.</motion.p>
            <motion.div initial={false} className="landing-enter landing-enter-actions mt-9 flex flex-wrap items-center gap-4">
              <LandingTransitionLink href="/auth/signup?callbackUrl=%2Fonboarding" className="group inline-flex h-12 items-center rounded-full bg-[#ADEBC1] px-6 text-sm font-semibold text-[#06100B] shadow-[0_16px_50px_rgba(173,235,193,0.14)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#CBF5D8] active:scale-[0.98]">
                Crear mi Twin <ArrowRight className="ml-2 size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </LandingTransitionLink>
              <a href="#sistema" className="group inline-flex h-12 items-center gap-2 px-2 text-sm font-medium text-white/70 transition-colors hover:text-white">Ver cómo aprende <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" /></a>
            </motion.div>
          </motion.div>
          <div><LandingTwinField /></div>
        </div>
      </section>
    </div>
  )
}
```

In `LandingPageContent`'s JSX, where the deleted inline hero section used to be, add:

```typescript
            <HeroSection scrollContainer={scrollRef} />
```

- [ ] **Step 5: Typecheck**

Run: `node --max-old-space-size=6144 ./node_modules/typescript/bin/tsc --noEmit --pretty false --incremental`
Expected: no new diagnostics. In particular, confirm no "unused variable" errors for anything that was removed (`heroProgress`, `heroCopyY`, `heroGraphY`, `heroGraphScale`, and the top-level `scrollYProgress` in `LandingPageContent` — all should be fully gone, not just unused).

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx jest app/landing/__tests__/landing-identity-motion.test.ts`
Expected: PASS, all tests including both new ones. Specifically confirm these pre-existing assertions still hold: `'Es contexto compartido.'`, `'La próxima interfaz para la IA'`, `'landing-enter landing-enter-lead'`, `'landing-enter landing-enter-title'`, `'landing-enter landing-enter-actions'`, `'@keyframes novo-enter'`.

- [ ] **Step 7: Commit**

```bash
git add app/landing/page.tsx app/landing/__tests__/landing-identity-motion.test.ts
git commit -m "feat(landing): pin hero section with scroll-scrubbed word-by-word headline reveal"
```

---

### Task 3: Full verification and visual QA

**Files:** none (verification only).

- [ ] **Step 1: Full typecheck**

Run: `node --max-old-space-size=6144 ./node_modules/typescript/bin/tsc --noEmit --pretty false --incremental`
Expected: clean (no new diagnostics versus the pre-existing baseline).

- [ ] **Step 2: Full focused test run**

Run: `npx jest app/landing/__tests__/landing-identity-motion.test.ts`
Expected: all PASS (11 tests: 9 pre-existing + 2 new from this plan).

- [ ] **Step 3: Full test suite (regression check)**

Run: `NODE_OPTIONS="--max-old-space-size=6144" npx jest --runInBand`
Expected: no new failures versus the pre-existing baseline (405/405 passing as of 2026-08-17, per the same-day device-presence-signal plan's final verification).

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: exits 0, generates `/landing` successfully.

- [ ] **Step 5: Visual QA with the browse skill**

Using the `/browse` skill (per this project's `CLAUDE.md`), against a locally running `npm run dev` or the deployed preview:
- Desktop (1440px): screenshot the hero mid-pin (partway through its scroll range) and the product section mid-crossfade — confirm the headline shows a mix of dim/blurred and sharp words (not all-or-nothing), and the product window shows a visible blend between the two screenshots (not an instant cut).
- Mobile (390px): repeat the same two screenshots — confirm the sticky panels don't clip content or cause visible layout shift, and the page doesn't scroll sideways (existing test already asserts `overflow-x-hidden` classes are present — this step is about visually confirming it, not re-testing the string).
- Emulate `prefers-reduced-motion: reduce` and reload: confirm the hero and product sections show their full final content immediately, with no `200dvh`-tall empty scroll region before or after them (i.e., the page's total scroll length is close to what it was before this plan, not padded out by ~4 extra viewport-heights).
- Click "Crear mi Twin" from both the pinned hero and the final CTA: confirm the existing page-transition overlay (`PageTransitionProvider`) still fires correctly and isn't visually broken by the new sticky sections sitting underneath it.

If any of these show a real problem, fix it directly (this is verification, not a new task) and re-run steps 1-2 before considering the plan complete.

- [ ] **Step 6: Rhythm check on the untouched sections**

The design spec calls for the Contexto (`ContextMask`), Sistema (`CognitiveSequence`), Precios, and Cierre sections to keep their current structure with only a minor timing/easing nudge so they feel continuous with the new pinned hero and product sections — no code changes are prescribed elsewhere in this plan because there's nothing to build, only a "does it feel disjointed" judgment call. While reviewing the Step 5 screenshots/scroll-through, check specifically whether the hand-off from the pinned hero into Contexto, and from the pinned product section into Precios, feels like a natural continuation or an abrupt cut. If it's abrupt, the fix is a small `transition` duration/delay tweak on the affected section's existing `motion.div`/`motion.h2` (already visible in the file, e.g. `ContextMask`'s `motion.h2` or the `Entenderte no significa...` section's `motion.h2`) — not a new mechanism. If it already feels fine, leave it alone (YAGNI: don't tune what isn't broken).

- [ ] **Step 7: Report**

Summarize what was verified (typecheck, focused tests, full suite, build, and the 4 visual QA checks) — this is the hand-off point before any deploy decision, which is the human's call, not this plan's.
