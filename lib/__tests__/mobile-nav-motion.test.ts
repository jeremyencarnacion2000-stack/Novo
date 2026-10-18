import { NAV_MORPH_REST_EVENT, waitForNavigationRest } from '@/lib/mobile-nav-motion'

describe('navigation physical presence', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('waits for the actual spring, completes once and removes its watchdog', () => {
    const surface = document.createElement('div')
    const done = jest.fn()
    waitForNavigationRest(surface, done)
    jest.advanceTimersByTime(1000)
    expect(done).not.toHaveBeenCalled()
    surface.dispatchEvent(new Event(NAV_MORPH_REST_EVENT))
    surface.dispatchEvent(new Event(NAV_MORPH_REST_EVENT))
    jest.runAllTimers()
    expect(done).toHaveBeenCalledTimes(1)
    expect(jest.getTimerCount()).toBe(0)
  })

  it('cancels an interrupted exit before reopening', () => {
    const surface = document.createElement('div')
    const done = jest.fn()
    const cancel = waitForNavigationRest(surface, done)
    cancel()
    surface.dispatchEvent(new Event(NAV_MORPH_REST_EVENT))
    jest.runAllTimers()
    expect(done).not.toHaveBeenCalled()
  })

  it('handles rest before controller registration and rescues a missing renderer', () => {
    const surface = document.createElement('div')
    surface.dataset.liquidMorphSettled = 'closed'
    const done = jest.fn()
    waitForNavigationRest(surface, done)
    expect(done).toHaveBeenCalledTimes(1)
    const lost = jest.fn()
    waitForNavigationRest(null, lost)
    jest.advanceTimersByTime(2400)
    expect(lost).toHaveBeenCalledTimes(1)
  })
})
