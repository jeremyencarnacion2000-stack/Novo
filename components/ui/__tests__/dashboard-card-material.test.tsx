import { render } from '@testing-library/react'
import { Card } from '@/components/ui/card'
import { GlassSurface } from '@/components/ui/GlassSurface'

jest.mock('@/lib/liquid-glass/useLiquidGlass', () => ({
  useLiquidGlass: ({ enabled = false }: { enabled?: boolean } = {}) => ({
    ref: { current: null },
    mapUrl: '',
    width: 480,
    height: 240,
    hasSVGFilterSupport: false,
    useSVGFilter: enabled,
    filterUrl: enabled ? 'url(#novo-test-lens)' : '',
    buildBackdropFilter: () => '',
  }),
}))

describe('dashboard liquid card material', () => {
  it('uses the Focus Surface contract for dashboard liquid cards', () => {
    const standard = render(<Card>Contenido</Card>)
    expect(standard.container.querySelector('[data-slot="card"]')).toHaveClass('glass-surface')
    expect(standard.container.querySelector('[data-slot="card"]')).not.toHaveClass('novo-focus-surface')

    const { container } = render(<Card variant="liquid">Contenido</Card>)
    const card = container.querySelector<HTMLElement>('[data-slot="card"]')
    const backdrop = container.querySelector<HTMLElement>('[data-novo-glass] > [data-glass-backdrop]')

    expect(card).toHaveClass('novo-focus-surface')
    expect(card).not.toHaveClass('novo-context-glass')
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
})
