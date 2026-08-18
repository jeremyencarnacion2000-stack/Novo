import fs from 'node:fs'
import path from 'node:path'

const landingSource = () => fs.readFileSync(path.join(process.cwd(), 'app', 'landing', 'page.tsx'), 'utf8')
const landingLoadingSource = () => fs.readFileSync(path.join(process.cwd(), 'app', 'landing', 'loading.tsx'), 'utf8')
const productCaptureAsset = () => path.join(process.cwd(), 'docs', 'release', 'evidence', 'current-cognitive-product-desktop.png')

describe('landing identity and motion', () => {
  it('uses the Novo application mark in the top bar', () => {
    expect(landingSource()).toContain('src="/icon.svg"')
  })

  it('uses a reduced-motion-safe authored hero reveal', () => {
    const source = landingSource()

    expect(source).toContain('clipPath: \'inset(0 0 0 0 round 1.75rem)\'')
    expect(source).toContain('useReducedMotion()')
    expect(source).toContain('transition={reduceMotion ? { duration: 0 }')
    expect(source).toContain('initial={false}')
  })

  it('routes every auth conversion CTA through the landing transition', () => {
    const source = landingSource()

    expect(source).toContain('function LandingTransitionLink')
    expect(source.match(/<LandingTransitionLink/g)?.length).toBeGreaterThanOrEqual(7)
    expect(source).not.toMatch(/<Link href="\/auth\/(?:signup|signin)/)
  })

  it('keeps a branded fallback visible while the landing hydrates', () => {
    const source = landingLoadingSource()

    expect(source).toContain('landing-ambient')
    expect(source).toContain('Menos explicación.')
    expect(source).toContain('Más contexto.')
  })

  it('grounds the visual story in the real product instead of generated artwork', () => {
    const source = landingSource()

    expect(source).toContain('Menos explicación.')
    expect(source).toContain('ProductWindow')
    expect(source).toContain('ContextMask')
    expect(source).toContain('current-cognitive-product-desktop.png')
    expect(source).not.toContain('/landing/product-ai.png')
    expect(source).not.toContain('/landing/cognitive-sculpture.png')
    expect(source).not.toContain('/landing/context-field.webp')
    expect(source).not.toContain('/landing/hero-atmosphere.png')
    expect(fs.existsSync(productCaptureAsset())).toBe(true)
  })

  it('opens with the shared-context category thesis and a navigable Twin field', () => {
    const source = landingSource()

    expect(source).toContain('La próxima interfaz para la IA')
    expect(source).toContain('Es contexto compartido.')
    expect(source).toContain('function LandingTwinField')
    expect(source).toContain('data-testid="landing-twin-field"')
    expect(source).toContain('aria-label="Explorar el contexto del Twin"')
    expect(source).toContain('aria-pressed={selected}')
  })

  it('clips decorative horizontal motion without creating a sideways mobile page', () => {
    expect(landingSource()).toContain('landing-ambient h-dvh overflow-x-hidden overflow-y-auto')
  })

  it('uses scroll-linked cognitive storytelling instead of repeating a flat reveal', () => {
    const source = landingSource()

    expect(source).toContain('function CognitiveSequence')
    expect(source).toContain('data-testid="cognitive-sequence"')
    expect(source).toContain('useMotionTemplate')
    expect(source).toContain('whileInView="visible"')
    expect(source).toContain('prefers-reduced-motion')
  })

  it('keeps the hero readable before hydration while its authored entrance runs', () => {
    const source = landingSource()

    expect(source).toContain('@keyframes novo-enter')
    expect(source).toContain('landing-enter landing-enter-lead')
    expect(source).toContain('landing-enter landing-enter-title')
    expect(source).toContain('landing-enter landing-enter-actions')
  })

  it('crossfades between the sparse and rich product states as the section pins on scroll', () => {
    const source = landingSource()

    expect(source).toContain('final-cognitive-preview-desktop.png')
    expect(source).toContain('function ProductSection')
    expect(source).toContain('richOpacity')
    expect(source).toContain('progress: MotionValue<number>')
  })

  it('pins the hero and reveals the headline word-by-word as the user scrolls', () => {
    const source = landingSource()

    expect(source).toContain('function HeroSection')
    expect(source).toContain('const HERO_HEADLINE')
    expect(source).toContain('function HeroWord')
  })
})
