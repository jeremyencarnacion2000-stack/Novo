import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CompanionMobileContext } from '@/components/companion/companion-mobile-context'

jest.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ language: 'es', t: (key: string) => key }),
}))
jest.mock('@/components/companion/developer-context-panel', () => ({ DeveloperContextPanel: () => null }))

describe('CompanionMobileContext', () => {
  const fetchMock = jest.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock as typeof fetch
  })

  it('loads the owner-scoped synced summary without requesting detailed window history', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        sourceExcluded: false,
        signals: [{
          sourceRef: 'daily:2026-10-08',
          signalType: 'device_activity_daily',
          label: 'Dispositivo: 2 h distribuidas en 3 aplicaciones',
          observedAt: '2026-10-08T12:00:00.000Z',
          reliability: 'deterministic',
        }],
      }),
    })

    render(<CompanionMobileContext />)

    await waitFor(() => expect(screen.getByText('Dispositivo: 2 h distribuidas en 3 aplicaciones')).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith('/api/companion/activity', expect.objectContaining({ cache: 'no-store' }))
    expect(screen.getByText(/solo resumen|resumen agregado/i)).toBeInTheDocument()
    expect(screen.queryByText(/daily:2026-10-08/)).not.toBeInTheDocument()
  })

  it('explains when the owner excluded the device signal source', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ sourceExcluded: true, signals: [] }) })

    render(<CompanionMobileContext />)

    await waitFor(() => expect(screen.getByText(/excluiste esta fuente|fuente está excluida/i)).toBeInTheDocument())
    expect(screen.queryByText(/sincronizado|synced/i)).not.toBeInTheDocument()
  })

  it('offers a retry without leaking provider errors', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ error: 'secret provider token' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sourceExcluded: false, signals: [] }) })

    render(<CompanionMobileContext />)
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('alert')).not.toHaveTextContent('secret provider token')
    fireEvent.click(screen.getByRole('button', { name: /intentar de nuevo/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })
})
