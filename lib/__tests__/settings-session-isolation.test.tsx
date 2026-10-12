import { act, render, screen, waitFor } from '@testing-library/react'
import { SettingsProvider, useSettings } from '@/lib/settings-context'

let mockSession: { data: { user: { id: string } } | null; status: 'authenticated' | 'unauthenticated' | 'loading' } = {
  data: { user: { id: 'user-a' } },
  status: 'authenticated',
}

jest.mock('next-auth/react', () => ({
  useSession: () => mockSession,
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function SettingsProbe() {
  const { settings } = useSettings()
  return <output data-testid="accent">{settings.accentColor}</output>
}

describe('SettingsProvider session isolation', () => {
  beforeEach(() => {
    mockSession = { data: { user: { id: 'user-a' } }, status: 'authenticated' }
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('does not hydrate a previous account after the session changes', async () => {
    const firstRead = deferred<{ ok: boolean; json: () => Promise<{ settings: { accentColor: string } }> }>()
    const secondRead = deferred<{ ok: boolean; json: () => Promise<{ settings: { accentColor: string } }> }>()
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url === '/api/user-settings') {
        return (fetchMock.mock.calls.length === 1 ? firstRead.promise : secondRead.promise) as Promise<Response>
      }
      return Promise.resolve({ ok: true, json: async () => ({}) } as Response)
    })

    const view = render(
      <SettingsProvider>
        <SettingsProbe />
      </SettingsProvider>,
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    mockSession = { data: { user: { id: 'user-b' } }, status: 'authenticated' }
    view.rerender(
      <SettingsProvider>
        <SettingsProbe />
      </SettingsProvider>,
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    await act(async () => {
      secondRead.resolve({ ok: true, json: async () => ({ settings: { accentColor: 'blue' } }) })
    })
    await waitFor(() => expect(screen.getByTestId('accent')).toHaveTextContent('blue'))

    await act(async () => {
      firstRead.resolve({ ok: true, json: async () => ({ settings: { accentColor: 'red' } }) })
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByTestId('accent')).toHaveTextContent('blue')
  })
})
