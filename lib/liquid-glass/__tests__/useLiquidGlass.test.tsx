import * as React from 'react'
import { render, waitFor } from '@testing-library/react'
import { useLiquidGlass } from '@/lib/liquid-glass/useLiquidGlass'

class GlassResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(target: Element) {
    this.callback([
      {
        target,
        contentRect: {
          width: 280,
          height: 56,
        } as DOMRectReadOnly,
      } as ResizeObserverEntry,
    ], this as unknown as ResizeObserver)
  }

  unobserve() {}
  disconnect() {}
}

function LensProbe() {
  const { ref, useSVGFilter } = useLiquidGlass({
    radius: 9999,
    depth: 4,
    blur: 1,
    strength: 24,
    chromaticAberration: 2.5,
    enabled: true,
  })

  return <div ref={ref} data-svg-lens={useSVGFilter ? 'true' : 'false'} />
}

describe('liquid glass SVG registry', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: GlassResizeObserver,
    })
  })

  it('shares its five-lens budget across surfaces instead of letting one listener consume it', async () => {
    const { container, unmount } = render(
      <>
        {Array.from({ length: 6 }, (_, index) => <LensProbe key={index} />)}
      </>,
    )

    await waitFor(() => {
      expect(container.querySelectorAll('[data-svg-lens="true"]')).toHaveLength(5)
    })

    unmount()
  })
})
