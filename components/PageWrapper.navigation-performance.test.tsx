import React from 'react'
import { render, screen } from '@testing-library/react'
import { PageWrapper } from './PageWrapper'

let mockPathname = '/today'

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

jest.mock('@/lib/scroll-container-context', () => ({
  useScrollContainer: () => ({ setScrollContainer: jest.fn() }),
}))

jest.mock('@/lib/cognitive-context', () => ({
  useCognitivePhase: () => 'LINEAR_EXECUTION',
}))

jest.mock('@/lib/settings-context', () => ({
  useSettings: () => ({ settings: { showAnimations: true } }),
}))

jest.mock('@/components/smooth-scroll-provider', () => ({
  SmoothScrollProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe('PageWrapper route transition performance', () => {
  beforeEach(() => {
    mockPathname = '/today'
  })

  it('does not keep the previous route tree mounted while the next route enters', () => {
    const view = render(
      <PageWrapper>
        <article data-route-surface="/today">Today</article>
      </PageWrapper>,
    )

    mockPathname = '/calendar'
    view.rerender(
      <PageWrapper>
        <article data-route-surface="/calendar">Calendar</article>
      </PageWrapper>,
    )

    expect(view.container.querySelectorAll('[data-route-surface]')).toHaveLength(1)
    expect(screen.getByText('Calendar')).toBeInTheDocument()
    expect(screen.queryByText('Today')).not.toBeInTheDocument()
  })
})
