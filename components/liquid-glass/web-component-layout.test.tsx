import React from 'react'
import { act, render } from '@testing-library/react'
import { GlassSurface } from '@/components/ui/GlassSurface'

jest.mock('@/lib/liquid-glass/useLiquidGlass', () => ({
  useLiquidGlass: () => ({
    ref: jest.requireActual('react').useRef(null),
    useSVGFilter: true, mapUrl: null, filterUrl: null,
    buildBackdropFilter: () => 'none',
  }),
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
})
