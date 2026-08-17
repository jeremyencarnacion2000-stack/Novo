import { render } from '@testing-library/react'
import { Card } from '@/components/ui/card'
import { GlassSurface } from '@/components/ui/GlassSurface'

jest.mock('@/lib/liquid-glass/useLiquidGlass', () => ({
  useLiquidGlass: () => ({
    ref: { current: null },
    filterUrl: '',
    mapUrl: '',
    width: 480,
    height: 240,
    hasSVGFilterSupport: false,
    useSVGFilter: false,
    buildBackdropFilter: () => '',
  }),
}))

describe('dashboard liquid card material', () => {
  it('preserves the original card hierarchy without forcing Focus Surface on every card', () => {
    const standard = render(<Card>Contenido</Card>)
    expect(standard.container.querySelector('[data-slot="card"]')).toHaveClass('glass-surface')
    expect(standard.container.querySelector('[data-slot="card"]')).not.toHaveClass('novo-focus-surface')

    const { container } = render(<Card variant="liquid">Contenido</Card>)
    const card = container.querySelector<HTMLElement>('[data-slot="card"]')
    const backdrop = container.querySelector<HTMLElement>('[data-novo-glass] > [data-glass-backdrop]')

    expect(card).toHaveClass('novo-context-glass')
    expect(card).not.toHaveClass('novo-focus-surface')
    expect(backdrop).not.toBeNull()
    expect(backdrop).toHaveClass('novo-glass-backdrop')
    expect(backdrop?.style.getPropertyValue('--novo-glass-backdrop-filter')).toBe(
      'var(--novo-context-backdrop-filter)',
    )
    expect(backdrop?.style.getPropertyValue('--novo-glass-background')).toBe(
      'var(--novo-context-background)',
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
})
