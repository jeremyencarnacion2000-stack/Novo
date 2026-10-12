import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DeveloperContextPanel } from '@/components/companion/developer-context-panel'

jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ language: 'es' }) }))

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body }
}

describe('DeveloperContextPanel', () => {
  const fetchMock = jest.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock as typeof fetch
  })

  it('shows only sanitized GitHub and selected Vercel summaries and reads both APIs without cache', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ connected: true, projects: [{ id: 'prj_1', name: 'novo-web', selected: true }], selectedProjectIds: ['prj_1'] }))
      .mockResolvedValueOnce(jsonResponse({
        github: { connected: true, sourceExcluded: false, repositories: [{ repository: 'acme/app', openPullRequests: 2, requestedReviewers: 1, latestReviewState: 'approved', ci: { passed: 3, failed: 0, pending: 1 } }] },
        vercel: { connected: true, sourceExcluded: false, projects: [{ id: 'prj_1', name: 'novo-web' }], deployments: [{ id: 'dep_1', projectId: 'prj_1', projectName: 'novo-web', state: 'READY', createdAt: '2026-10-08T10:00:00.000Z', url: 'https://novo-web.example' }] },
      }))

    render(<DeveloperContextPanel />)

    await waitFor(() => expect(screen.getByText(/acme\/app/)).toBeInTheDocument())
    expect(screen.getByText(/2 PR abiertos/)).toBeInTheDocument()
    expect(screen.getByText(/READY/)).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'novo-web' })).toBeChecked()
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/integration/vercel', expect.objectContaining({ cache: 'no-store' }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/companion/developer-context', expect.objectContaining({ cache: 'no-store' }))
  })

  it('submits the Vercel token once and clears the password field immediately', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ connected: false, projects: [], selectedProjectIds: [] }))
      .mockResolvedValueOnce(jsonResponse({ github: { connected: false, sourceExcluded: false, repositories: [] }, vercel: { connected: false, sourceExcluded: false, projects: [], deployments: [] } }))
      .mockResolvedValueOnce(jsonResponse({ connected: true, projects: [{ id: 'prj_1', name: 'novo-web' }], selectedProjectIds: [] }))

    render(<DeveloperContextPanel />)
    await waitFor(() => expect(screen.getByLabelText(/token personal de vercel/i)).toBeInTheDocument())
    const tokenInput = screen.getByLabelText(/token personal de vercel/i) as HTMLInputElement
    fireEvent.change(tokenInput, { target: { value: 'vercel-secret-token' } })
    fireEvent.click(screen.getByRole('button', { name: /conectar vercel/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ accessToken: 'vercel-secret-token' })
    expect(tokenInput).toHaveValue('')
  })

  it('requires a visible preview before copying a minimal summary for the Twin', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ connected: false, projects: [], selectedProjectIds: [] }))
      .mockResolvedValueOnce(jsonResponse({
        github: { connected: true, sourceExcluded: false, repositories: [{ repository: 'acme/app', openPullRequests: 2, requestedReviewers: 1, latestReviewState: 'approved', ci: { passed: 3, failed: 0, pending: 1 } }] },
        vercel: { connected: false, sourceExcluded: false, projects: [], deployments: [] },
      }))
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: jest.fn().mockResolvedValue(undefined) } })

    render(<DeveloperContextPanel />)
    await waitFor(() => expect(screen.getByText(/acme\/app/)).toBeInTheDocument())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /previsualizar contexto/i }))
    expect(screen.getByRole('dialog')).toHaveTextContent('acme/app')
    fireEvent.click(screen.getByRole('button', { name: /copiar contexto y pedir propuesta/i }))

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('2 PR abiertos')))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('Propón tres próximos pasos; no ejecutes cambios.'))
    expect(await screen.findByRole('link', { name: /abrir el twin/i })).toHaveAttribute('href', '/cognitive')
  })

  it('excludes a connected GitHub source from future context requests', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ connected: true, projects: [], selectedProjectIds: [] }))
      .mockResolvedValueOnce(jsonResponse({
        github: { connected: true, sourceExcluded: false, repositories: [{ repository: 'acme/app', openPullRequests: 1, requestedReviewers: 0, latestReviewState: 'none', ci: { passed: 0, failed: 0, pending: 0 } }] },
        vercel: { connected: false, sourceExcluded: false, projects: [], deployments: [] },
      }))
      .mockResolvedValueOnce(jsonResponse({ sourcePreference: { source: 'github', excludedAt: '2026-10-08T12:00:00.000Z' } }))

    render(<DeveloperContextPanel />)
    await waitFor(() => expect(screen.getByText(/acme\/app/)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /excluir fuente github/i }))

    await waitFor(() => expect(screen.getByRole('button', { name: /restaurar fuente github/i })).toBeInTheDocument())
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/cognitive/loop/signals', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ action: 'exclude_source', source: 'github', reason: 'companion_source_control' }),
    }))
  })
})
