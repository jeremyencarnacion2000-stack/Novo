import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SettingsMcpAccess } from '@/components/settings/settings-mcp-access'

jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ language: 'es', t: (key: string) => key }) }))

describe('SettingsMcpAccess native companion permissions', () => {
  const fetchMock = jest.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const isCreate = init?.method === 'POST'
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => isCreate
          ? { token: 'novo_mcp_once', record: {} }
          : { tokens: [] },
      }
    })
    global.fetch = fetchMock as typeof fetch
  })

  it('lets users grant companion capture without granting task edits', async () => {
    render(<SettingsMcpAccess />)

    fireEvent.change(screen.getByLabelText('Nombre del dispositivo'), { target: { value: 'Mi Novo Companion' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /Permitir registrar aplicaciones y tiempos de uso/ }))
    fireEvent.click(screen.getByRole('button', { name: /Crear token/ }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/mcp/tokens', expect.objectContaining({ method: 'POST' })))
    const createRequest = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')?.[1]
    const payload = JSON.parse(String(createRequest?.body))

    expect(payload.allowDeviceActivity).toBe(true)
    expect(payload.allowTaskWrites).toBe(false)
  })

  it('lets a companion read connected-source context without integration writes', async () => {
    render(<SettingsMcpAccess />)

    fireEvent.change(screen.getByLabelText('Nombre del dispositivo'), { target: { value: 'Mi Novo Companion' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /Leer el estado de fuentes conectadas/ }))
    fireEvent.click(screen.getByRole('button', { name: /Crear token/ }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/mcp/tokens', expect.objectContaining({ method: 'POST' })))
    const createRequest = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')?.[1]
    const payload = JSON.parse(String(createRequest?.body))

    expect(payload.allowIntegrationRead).toBe(true)
    expect(payload.allowIntegrationSync).toBe(false)
  })

  it('lets users create a separate Companion login and chat token without task or capture writes', async () => {
    render(<SettingsMcpAccess />)

    fireEvent.change(screen.getByLabelText('Nombre del dispositivo'), { target: { value: 'Novo PC' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /Permitir vincular Novo Companion y usar su chat/ }))
    fireEvent.click(screen.getByRole('button', { name: /Crear token/ }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/mcp/tokens', expect.objectContaining({ method: 'POST' })))
    const createRequest = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')?.[1]
    const payload = JSON.parse(String(createRequest?.body))

    expect(payload.allowCompanion).toBe(true)
    expect(payload.allowTaskWrites).toBe(false)
    expect(payload.allowDeviceActivity).toBe(false)
  })
})
