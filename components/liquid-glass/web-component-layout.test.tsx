import React from 'react'
import { act, render } from '@testing-library/react'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { useLiquidGlass } from '@/lib/liquid-glass/useLiquidGlass'

jest.mock('@/lib/liquid-glass/useLiquidGlass', () => ({
  useLiquidGlass: jest.fn(() => ({
    ref: jest.requireActual('react').useRef(null),
    useSVGFilter: true, mapUrl: null, filterUrl: null,
    buildBackdropFilter: () => 'none',
  })),
}))

describe('optical geometry during shared-element transforms', () => {
  beforeAll(() => {
    if (!customElements.get('glass-element')) customElements.define('glass-element', class extends HTMLElement {})
  })
  afterEach(() => jest.restoreAllMocks())

  it('sizes the lens from layout rather than the scaled mid-flight snapshot', () => {
    let width = 348
    jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(() => width)
    jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(224)
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 310, height: 56 } as DOMRect)
    const view = render(<GlassSurface webComponent refractive preset="navigation" />)
    const lens = view.container.querySelector('glass-element')!
    expect(lens).toHaveAttribute('width', '348')
    expect(lens).toHaveAttribute('height', '224')
    width = 380
    act(() => window.dispatchEvent(new Event('resize')))
    expect(lens).toHaveAttribute('width', '380')
    expect(view.container.querySelector('glass-element')).toBe(lens)
  })

  it('shares the navigation tint token with the actual custom element', () => {
    jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(348)
    jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(224)
    const view = render(<GlassSurface webComponent refractive navigationMaterial="panel" />)
    expect(view.container.querySelector('[data-navigation-material="panel"]')).toHaveClass('novo-navigation-glass')
    expect(view.container.querySelector('glass-element')).toHaveAttribute('background-color', 'var(--novo-navigation-tint)')
    expect(view.container.querySelector('[data-glass-backdrop]')).toBeNull()
  })

  it.each(['(prefers-reduced-transparency: reduce)', '(prefers-contrast: more)', '(forced-colors: active)'])(
    'releases the navigation lens for %s while keeping a readable fallback', query => {
      jest.spyOn(window, 'matchMedia').mockImplementation(value => ({
        matches: value === query, addEventListener: jest.fn(), removeEventListener: jest.fn(),
      } as unknown as MediaQueryList))
      const view = render(<GlassSurface webComponent refractive navigationMaterial="bar" />)
      expect(view.container.querySelector('glass-element')).toBeNull()
      expect(view.container.querySelector('[data-glass-backdrop]')).not.toBeNull()
      expect(jest.mocked(useLiquidGlass).mock.calls.at(-1)?.[0].active).toBe(false)
    },
  )
})
