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
    expect(global.fetch).toHaveBeenCalledWith('/api/cognitive/ambient', { cache: 'no-store' })

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    act(() => jest.advanceTimersByTime(15 * 60 * 1000))
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('lets the Dashboard own its context request', () => {
    usePathname.mockReturnValue('/')
    render(<AmbientContextHeartbeat />)
    expect(global.fetch).not.toHaveBeenCalled()
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
