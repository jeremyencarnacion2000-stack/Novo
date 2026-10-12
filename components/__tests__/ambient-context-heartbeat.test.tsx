import { act, render } from '@testing-library/react'
import { AmbientContextHeartbeat } from '../ambient-context-heartbeat'

const useSession = jest.fn()
const usePathname = jest.fn()

jest.mock('next-auth/react', () => ({ useSession: () => useSession() }))
jest.mock('next/navigation', () => ({ usePathname: () => usePathname() }))

describe('AmbientContextHeartbeat', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    useSession.mockReturnValue({ status: 'authenticated' })
    usePathname.mockReturnValue('/projects')
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as jest.Mock
  })

  afterEach(() => jest.useRealTimers())

  it('refreshes authenticated context outside the Dashboard and keeps a 15 minute cadence', async () => {
    render(<AmbientContextHeartbeat />)
    // The first refresh is intentionally deferred so route data and the first
    // interaction are not competing with the ambient reconciliation request.
    expect(global.fetch).not.toHaveBeenCalled()

    act(() => jest.advanceTimersByTime(2500))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(global.fetch).toHaveBeenCalledWith('/api/cognitive/ambient', { cache: 'no-store' })

    act(() => jest.advanceTimersByTime(15 * 60 * 1000))
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('lets the Dashboard own its context request', () => {
    usePathname.mockReturnValue('/')
    render(<AmbientContextHeartbeat />)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('keeps its refresh schedule across authenticated section changes', async () => {
    const view = render(<AmbientContextHeartbeat />)

    act(() => jest.advanceTimersByTime(1000))
    usePathname.mockReturnValue('/calendar')
    view.rerender(<AmbientContextHeartbeat />)

    await act(async () => {
      jest.advanceTimersByTime(1500)
      await Promise.resolve()
    })

    expect(global.fetch).toHaveBeenCalledTimes(1)

    usePathname.mockReturnValue('/routines')
    view.rerender(<AmbientContextHeartbeat />)
    act(() => jest.advanceTimersByTime(2500))
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('does not overlap refresh requests while a previous heartbeat is in flight', async () => {
    let finishRequest!: () => void
    ;(global.fetch as jest.Mock).mockImplementation(() => new Promise<void>((resolve) => {
      finishRequest = resolve
    }))

    render(<AmbientContextHeartbeat />)
    await act(async () => {
      jest.advanceTimersByTime(30 * 60 * 1000)
    })
    expect(global.fetch).toHaveBeenCalledTimes(1)

    await act(async () => finishRequest())
    await act(async () => {
      jest.advanceTimersByTime(15 * 60 * 1000)
    })
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })
})
