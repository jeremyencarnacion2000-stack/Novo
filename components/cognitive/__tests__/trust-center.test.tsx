import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TrustCenter } from '../trust-center'

jest.mock('@/components/cognitive/signal-ledger-controls', () => ({ SignalLedgerControls: () => <div data-testid="signal-ledger" /> }))

describe('TrustCenter', () => {
  beforeEach(() => {
    ;(global.fetch as jest.Mock) = jest.fn((url: string, options?: RequestInit) => {
      if (url === '/api/cognitive/learning-preference' && options?.method === 'POST') return Promise.resolve(new Response(JSON.stringify({ paused: true }), { status: 200 }))
      if (url === '/api/cognitive/learning-preference') return Promise.resolve(new Response(JSON.stringify({ paused: false }), { status: 200 }))
      if (url === '/api/cognitive/loop/signals') return Promise.resolve(new Response(JSON.stringify({ signals: [{ source: 'task', excludedAt: null }, { source: 'calendar', excludedAt: null }], sourcePreferences: [] }), { status: 200 }))
      if (url === '/api/integration/status') return Promise.resolve(new Response(JSON.stringify({ google: true, spotify: false }), { status: 200 }))
      return Promise.resolve(new Response('{}', { status: 404 }))
    })
  })

  it('shows auditable sources and persists the learning pause', async () => {
    const user = userEvent.setup()
    render(<TrustCenter language="es" />)
    await screen.findByText('task · Local · Activa')
    await screen.findByText('calendar · Cloud · Activa')
    expect(screen.getByText('1 conexiones con permiso de lectura disponible')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'Pausar aprendizaje' }))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/cognitive/learning-preference', expect.objectContaining({ method: 'POST', body: JSON.stringify({ paused: true }) })))
    expect(screen.getByText('Reanudar aprendizaje')).toBeInTheDocument()
  })
})
