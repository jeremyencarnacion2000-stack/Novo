import * as React from 'react'
import { render, waitFor } from '@testing-library/react'
import { useLiquidGlass } from '@/lib/liquid-glass/useLiquidGlass'

import { GlassSurface } from "@/components/ui/GlassSurface"

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

  it("grants at most five web-component lenses and keeps the displaced surface frosted", async () => {
    if (!customElements.get("glass-element")) {
      customElements.define("glass-element", class extends HTMLElement {})
    }

    const { container, unmount } = render(
      <>
        {Array.from({ length: 6 }, (_, index) => (
          <GlassSurface key={index} preset="control" refractive webComponent>
            <span>Control {index}</span>
          </GlassSurface>
        ))}
      </>,
    )

    await waitFor(() => {
      expect(container.querySelectorAll("glass-element")).toHaveLength(5)
      expect(container.querySelectorAll("[data-glass-backdrop]")).toHaveLength(1)
    })

    unmount()
  })

  it("does not build an unused React SVG filter behind an active web component", async () => {
    if (!customElements.get("glass-element")) {
      customElements.define("glass-element", class extends HTMLElement {})
    }
    const initialFilterCount = document.querySelectorAll("#_ng_defs filter").length
    const { container, unmount } = render(
      <GlassSurface radius={37} depth={9} strength={83} chromaticAberration={7} refractive webComponent>
        <span>Optical control</span>
      </GlassSurface>,
    )

    await waitFor(() => expect(container.querySelector("glass-element")).not.toBeNull())
    expect(document.querySelectorAll("#_ng_defs filter")).toHaveLength(initialFilterCount)

    unmount()
  })
})
