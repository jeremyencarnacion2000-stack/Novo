import React from 'react'
import type {} from 'react/canary'
import { act, render, screen } from '@testing-library/react'
import { LiquidRouteTransition } from '@/components/liquid-route-transition'
import { rememberNavigationOrigin } from '@/lib/navigation-origin'

let mockPath = '/today'
let mockMode = 'full'
jest.mock('next/navigation', () => ({ usePathname: () => mockPath }))
jest.mock('@/hooks/use-novo-motion-policy', () => ({ useNovoMotionPolicy: () => mockMode }))
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  ViewTransition: jest.fn(({ children }) => children),
}))

describe('route liquid handoff', () => {
  beforeEach(() => { mockMode = 'full'; mockPath = '/today'; jest.clearAllMocks() })

  it.each([['full', 'novo-route-liquid'], ['reduced', 'novo-route-fade'], ['off', 'none']])(
    'uses one content-only snapshot in %s mode', (mode, share) => {
      mockMode = mode
      render(<LiquidRouteTransition><main>Today</main></LiquidRouteTransition>)
      expect(React.ViewTransition).toHaveBeenLastCalledWith(
        expect.objectContaining({ name: 'novo-route', default: 'none', share }), undefined,
      )
    },
  )

  it('replaces the live route immediately without retaining stale children', () => {
    const view = render(<LiquidRouteTransition><main>Today</main></LiquidRouteTransition>)
    mockPath = '/cognitive'
    view.rerender(<LiquidRouteTransition><main>Cognitive</main></LiquidRouteTransition>)
    expect(screen.queryByText('Today')).not.toBeInTheDocument()
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('allows a destination to enter after its independent auth shell becomes ready', () => {
    rememberNavigationOrigin(document.body, '/cognitive')
    mockPath = '/cognitive'
    render(<LiquidRouteTransition><main>Cognitive</main></LiquidRouteTransition>)
    expect(React.ViewTransition).toHaveBeenLastCalledWith(
      expect.objectContaining({ enter: 'novo-route-liquid' }), undefined,
    )
  })

  it('does not animate an unpaired initial or auth render', () => {
    mockPath = '/projects'
    render(<LiquidRouteTransition><main>Projects</main></LiquidRouteTransition>)
    expect(React.ViewTransition).toHaveBeenLastCalledWith(
      expect.objectContaining({ enter: 'none', default: 'none' }), undefined,
    )
  })

  it('cancels the delayed-shell fallback when the native transition owns the frame', () => {
    let frame!: FrameRequestCallback
    const raf = jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frame = callback; return 1 })
    const cancel = jest.fn()
    const animate = jest.fn(() => ({ cancel }))
    Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate })
    rememberNavigationOrigin(document.body, '/today')
    const view = render(<LiquidRouteTransition><main>Today</main></LiquidRouteTransition>)
    act(() => frame(16))
    expect(animate).toHaveBeenCalledTimes(1)
    const props = (React.ViewTransition as unknown as jest.Mock).mock.calls.at(-1)[0]
    act(() => props.onShare())
    expect(cancel).toHaveBeenCalled()
    view.unmount()
    raf.mockRestore()
    Reflect.deleteProperty(HTMLElement.prototype, 'animate')
  })
})
