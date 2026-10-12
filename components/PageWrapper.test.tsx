import React from 'react'
import { render, waitFor } from '@testing-library/react'
import { PageWrapper } from './PageWrapper'

const observedScrollElements: Array<HTMLElement | null | undefined> = []

jest.mock('next/navigation', () => ({
  usePathname: () => '/today',
}))

jest.mock('@/lib/scroll-container-context', () => ({
  useScrollContainer: () => ({ setScrollContainer: jest.fn() }),
}))

jest.mock('@/lib/cognitive-context', () => ({
  useCognitivePhase: () => 'LINEAR_EXECUTION',
}))

jest.mock('framer-motion', () => {
  const React = require('react')
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      div: React.forwardRef(function MotionDiv(
        { children, onAnimationComplete: _onAnimationComplete, ...props }: React.HTMLAttributes<HTMLDivElement> & { onAnimationComplete?: () => void },
        ref: React.ForwardedRef<HTMLDivElement>
      ) {
        return <div ref={ref} {...props}>{children}</div>
      }),
    },
  }
})

jest.mock('@/components/smooth-scroll-provider', () => ({
  SmoothScrollProvider: ({
    children,
    scrollElement,
  }: {
    children: React.ReactNode
    scrollElement?: HTMLElement | null
  }) => {
    observedScrollElements.push(scrollElement)
    return <>{children}</>
  },
}))

describe('PageWrapper smooth scrolling', () => {
  beforeEach(() => {
    observedScrollElements.length = 0
  })

  it('passes its mounted page scroller to SmoothScrollProvider', async () => {
    render(<PageWrapper><p>Today</p></PageWrapper>)

    await waitFor(() => {
      expect(observedScrollElements.at(-1)).toBeInstanceOf(HTMLElement)
    })
  })
})
