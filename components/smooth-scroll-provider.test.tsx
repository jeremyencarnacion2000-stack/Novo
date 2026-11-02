import React from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import Lenis from 'lenis'
import { SmoothScrollProvider, useLenis } from './smooth-scroll-provider'

let mockShowAnimations = true
const mockInstances: Array<{ destroy: jest.Mock; raf: jest.Mock }> = []

jest.mock('next/navigation', () => ({ usePathname: () => '/today' }))
jest.mock('@/lib/settings-context', () => ({
  useSettings: () => ({ settings: { showAnimations: mockShowAnimations } }),
}))
jest.mock('lenis', () => ({
  __esModule: true,
  default: jest.fn(() => {
    const instance = {
      isScrolling: false, velocity: 0,
      scrollTo: jest.fn(), resize: jest.fn(), raf: jest.fn(), destroy: jest.fn(),
    }
    mockInstances.push(instance)
    return instance
  }),
}))

function ScrollStatus() {
  return <output>{useLenis() ? 'enhanced scroll' : 'native scroll'}</output>
}

describe('SmoothScrollProvider motion policy', () => {
  const originalResizeObserver = global.ResizeObserver
  let scroller: HTMLDivElement
  let frames: Map<number, FrameRequestCallback>
  let motionQuery: MediaQueryList
  let listeners: Set<() => void>

  const setReducedMotion = (matches: boolean) => act(() => {
    Object.assign(motionQuery, { matches })
    listeners.forEach(listener => listener())
  })
  const surface = () => (
    <SmoothScrollProvider scrollElement={scroller}><ScrollStatus /></SmoothScrollProvider>
  )

  beforeEach(() => {
    mockShowAnimations = true
    mockInstances.length = 0
    jest.mocked(Lenis).mockClear()
    listeners = new Set()
    motionQuery = {
      matches: false,
      addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
    } as unknown as MediaQueryList
    jest.spyOn(window, 'matchMedia').mockReturnValue(motionQuery)
    global.ResizeObserver = jest.fn(() => ({
      observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn(),
    })) as unknown as typeof ResizeObserver
    let nextFrame = 0
    frames = new Map()
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      frames.set(++nextFrame, callback)
      return nextFrame
    })
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id) })
    scroller = document.createElement('div')
    scroller.style.overflowY = 'auto'
    scroller.append(document.createElement('article'))
    document.body.append(scroller)
  })

  afterEach(() => {
    cleanup()
    scroller.remove()
    global.ResizeObserver = originalResizeObserver
    jest.restoreAllMocks()
    document.documentElement.removeAttribute('data-novo-motion')
  })

  it('uses native scrolling without starting Lenis when the system requests reduced motion', () => {
    Object.assign(motionQuery, { matches: true })
    render(surface())
    expect(screen.getByText('native scroll')).toBeInTheDocument()
    expect(Lenis).not.toHaveBeenCalled()
    scroller.scrollTop = 120
    scroller.dispatchEvent(new Event('wheel'))
    expect(scroller.scrollTop).toBe(120)
    expect(frames.size).toBe(0)
  })

  it('releases the live scroll driver and its scheduled frame on motion changes', () => {
    const view = render(surface())
    expect(screen.getByText('enhanced scroll')).toBeInTheDocument()
    scroller.dispatchEvent(new Event('wheel'))
    expect(frames.size).toBe(1)

    setReducedMotion(true)
    expect(screen.getByText('native scroll')).toBeInTheDocument()
    expect(mockInstances[0].destroy).toHaveBeenCalledTimes(1)
    expect(frames.size).toBe(0)
    scroller.dispatchEvent(new Event('wheel'))
    expect(frames.size).toBe(0)

    setReducedMotion(false)
    expect(screen.getByText('enhanced scroll')).toBeInTheDocument()
    expect(Lenis).toHaveBeenCalledTimes(2)
    scroller.dispatchEvent(new Event('wheel'))
    expect(frames.size).toBe(1)
    mockShowAnimations = false
    view.rerender(surface())
    expect(screen.getByText('native scroll')).toBeInTheDocument()
    expect(mockInstances[1].destroy).toHaveBeenCalledTimes(1)
    expect(frames.size).toBe(0)
    scroller.dispatchEvent(new Event('wheel'))
    expect(frames.size).toBe(0)
  })
})
