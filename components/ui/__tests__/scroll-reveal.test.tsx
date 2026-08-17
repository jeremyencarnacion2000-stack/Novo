import type { ComponentType, PropsWithChildren } from 'react'
import { render, screen } from '@testing-library/react'
import { ScrollReveal } from '@/components/ui/scroll-reveal'

describe('ScrollReveal', () => {
  beforeAll(() => {
    class IdleIntersectionObserver implements IntersectionObserver {
      readonly root = null
      readonly rootMargin = '0px'
      readonly thresholds = [0]
      disconnect = jest.fn()
      observe = jest.fn()
      takeRecords = jest.fn(() => [])
      unobserve = jest.fn()
    }

    Object.defineProperty(globalThis, 'IntersectionObserver', {
      configurable: true,
      writable: true,
      value: IdleIntersectionObserver,
    })
  })

  it('keeps progressive content visible before viewport observation runs', () => {
    const ProgressiveScrollReveal = ScrollReveal as ComponentType<
      PropsWithChildren<{ progressive?: boolean }>
    >

    render(
      <ProgressiveScrollReveal progressive>
        <p>Contenido posterior al hero</p>
      </ProgressiveScrollReveal>,
    )

    const reveal = screen.getByText('Contenido posterior al hero').parentElement

    expect(reveal).toBeVisible()
    expect(reveal).not.toHaveStyle({ opacity: '0' })
  })
})
