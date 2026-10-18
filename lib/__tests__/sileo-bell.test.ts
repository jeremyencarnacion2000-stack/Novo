import { markSileoBellPresented, sileo, subscribeSileoBell } from '@/lib/sileo-bell'

describe('notice readable dwell', () => {
  beforeEach(() => { jest.useFakeTimers(); sileo.clear() })
  afterEach(() => { sileo.clear(); jest.useRealTimers() })

  it('starts the short replacement lifetime after its reveal and ignores stale dismissal', () => {
    const listener = jest.fn()
    const unsubscribe = subscribeSileoBell(listener)
    const previous = sileo.info({ title: 'Anterior', duration: 100 })
    const next = sileo.info({ title: 'Siguiente', duration: 100 })
    jest.advanceTimersByTime(2000)
    expect(listener.mock.calls.at(-1)?.[0]?.id).toBe(next)
    sileo.dismiss(previous)
    expect(listener.mock.calls.at(-1)?.[0]?.id).toBe(next)
    markSileoBellPresented(next)
    jest.advanceTimersByTime(99)
    expect(listener.mock.calls.at(-1)?.[0]?.id).toBe(next)
    jest.advanceTimersByTime(1)
    expect(listener).toHaveBeenLastCalledWith(null)
    unsubscribe()
  })

  it('preserves an explicitly persistent notice until it is dismissed', () => {
    const listener = jest.fn()
    const unsubscribe = subscribeSileoBell(listener)
    const id = sileo.info({ title: 'En curso', duration: null })
    markSileoBellPresented(id)
    jest.advanceTimersByTime(60000)
    expect(listener.mock.calls.at(-1)?.[0]?.id).toBe(id)
    sileo.dismiss(id)
    expect(listener).toHaveBeenLastCalledWith(null)
    unsubscribe()
  })
})
