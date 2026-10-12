import { render } from '@testing-library/react'
import { Card } from '@/components/ui/card'
import { GlassSurface } from '@/components/ui/GlassSurface'
import DashboardClient from '@/components/dashboard-client'

jest.mock('@/lib/settings-context', () => ({ useSettings: () => ({ settings: {} }) }))
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('@/lib/cognitive-context', () => ({ useCognitivePhase: () => 'LINEAR_EXECUTION' }))
jest.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }))
jest.mock('@/components/dashboard-metrics', () => ({ DashboardMetrics: () => null }))
jest.mock('@/components/quick-actions', () => ({ QuickActions: () => null }))
jest.mock('@/components/recent-activity', () => ({ RecentActivity: () => null }))
jest.mock('@/components/dashboard-habits', () => ({ DashboardHabits: () => null }))
jest.mock('@/components/dashboard/dashboard-quick-view', () => ({ DashboardQuickView: () => null }))
jest.mock('@/components/cognitive/cognitive-engine-widget', () => ({ CognitiveEngineWidget: () => null }))
jest.mock('@/components/dashboard/now-hero', () => ({ NowHero: () => null }))
jest.mock('@/components/ui/scroll-reveal', () => ({ ScrollReveal: ({ children }: { children: React.ReactNode }) => children }))

jest.mock('@/lib/liquid-glass/useLiquidGlass', () => ({
  useLiquidGlass: ({ enabled = false }: { enabled?: boolean } = {}) => ({
    ref: { current: null },
    mapUrl: '',
    width: 480,
    height: 240,
    hasSVGFilterSupport: false,
    useSVGFilter: enabled,
    filterUrl: enabled ? 'url(#novo-test-lens)' : '',
    buildBackdropFilter: () => 'blur(0.5px) url(#novo-test-lens) blur(1px) brightness(1.1) saturate(1.5)',
  }),
}))

describe('dashboard liquid card material', () => {
  it('keeps ordinary dashboard cards on CSS glass without SVG refraction leases', () => {
    const { container } = render(<DashboardClient />)
    const cards = Array.from(container.querySelectorAll<HTMLElement>('[data-slot="card"]'))

    expect(cards).toHaveLength(2)
    expect(cards.map((card) => card.dataset.variant)).toEqual(['primary', 'primary'])
    expect(container.querySelectorAll('[data-slot="card"][data-liquid-refractive="svg"]')).toHaveLength(0)
    expect(cards.every((card) => card.classList.contains('glass-surface'))).toBe(true)
  })

  it('uses the Focus Surface contract for dashboard liquid cards', () => {
    const standard = render(<Card>Contenido</Card>)
    expect(standard.container.querySelector('[data-slot="card"]')).toHaveClass('glass-surface')
    expect(standard.container.querySelector('[data-slot="card"]')).not.toHaveClass('novo-focus-surface')

    const { container } = render(<Card variant="liquid">Contenido</Card>)
    const card = container.querySelector<HTMLElement>('[data-slot="card"]')
    const backdrop = container.querySelector<HTMLElement>('[data-novo-glass] > [data-glass-backdrop]')

    expect(card).toHaveClass('novo-focus-surface')
    expect(card).not.toHaveClass('novo-context-glass')
    // The Settings-controlled backdrop is a child layer. Isolating its host
    // creates a new backdrop root, so Chromium can only sample the host's
    // transparent plane instead of the wallpaper behind the card.
    expect(card?.style.isolation).not.toBe('isolate')
    expect(backdrop).not.toBeNull()
    expect(backdrop).toHaveClass('novo-glass-backdrop')
    expect(backdrop?.style.getPropertyValue('--novo-glass-backdrop-filter')).toBe(
      'var(--novo-focus-backdrop-filter)',
    )
    expect(container.querySelector('[data-liquid-refractive="svg"]')).not.toBeNull()
    const refractive = container.querySelector<HTMLElement>('[data-glass-refractive]')
    expect(refractive).not.toBeNull()
    expect(refractive).toHaveAttribute('data-glass-refractive-mode', 'svg')
    expect(refractive?.style.getPropertyValue('--novo-glass-refractive-opacity')).toBe(
      'var(--novo-focus-refractive-opacity, 0.72)',
    )
    expect(refractive?.style.backdropFilter).toBe(
      'blur(0.5px) url(#novo-test-lens) blur(1px) brightness(1.1) saturate(1.5)',
    )
    expect(backdrop?.style.getPropertyValue('--novo-glass-background')).toBe(
      'var(--novo-focus-background)',
    )

    const sheen = container.querySelector<HTMLElement>('[data-glass-sheen]')
    expect(sheen).not.toBeNull()
    expect(sheen?.style.getPropertyValue('--novo-glass-sheen-opacity')).toBe(
      'calc(var(--novo-focus-refractive-opacity, 0.72) * 0.46)',
    )
  })

  it('applies Context Glass to the shared GlassSurface', () => {
    const { container } = render(<GlassSurface>Contenido</GlassSurface>)
    const surface = container.querySelector<HTMLElement>('[data-novo-glass]')
    const backdrop = container.querySelector<HTMLElement>('[data-glass-backdrop]')

    expect(surface).toHaveClass('novo-context-glass')
    expect(backdrop?.style.getPropertyValue('--novo-glass-backdrop-filter')).toBe(
      'var(--novo-context-backdrop-filter)',
    )
    expect(backdrop?.style.getPropertyValue('--novo-glass-background')).toBe(
      'var(--novo-context-background)',
    )
  })

  it('mounts a refractive lens whenever a surface opts into the material', () => {
    const { container } = render(<GlassSurface refractive>Contenido</GlassSurface>)
    const lens = container.querySelector<HTMLElement>('[data-glass-refractive]')

    expect(lens).not.toBeNull()
    expect(lens).toHaveAttribute('data-glass-refractive-mode', 'svg')
  })

  it('calibrates optical geometry from a semantic preset', () => {
    const { container } = render(
      <GlassSurface preset="status" refractivePriority="critical">
        Pensando
      </GlassSurface>,
    )
    const surface = container.querySelector<HTMLElement>('[data-novo-glass]')

    expect(surface).toHaveAttribute('data-glass-preset', 'status')
    expect(surface).toHaveAttribute('data-refractive-priority', 'critical')
    expect(surface).toHaveStyle({ borderRadius: '64px' })
  })

  it('keeps a semantic glass preset free of RGB refraction unless explicitly opted in', () => {
    const { container } = render(<GlassSurface preset="panel">Solo glassmorphism</GlassSurface>)
    const surface = container.querySelector<HTMLElement>('[data-novo-glass]')

    expect(surface).toHaveAttribute('data-glass-preset', 'panel')
    expect(surface).toHaveAttribute('data-liquid-refractive', 'off')
    expect(container.querySelector('[data-glass-refractive]')).toBeNull()
  })
})
