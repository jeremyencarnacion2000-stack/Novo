import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NovoLoopCard } from '../novo-loop-card'

jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ language: 'es' }) }))
jest.mock('@/components/ai/novo-activity-surface', () => ({ NovoActivitySurface: () => null }))
jest.mock('@/components/cognitive/signal-ledger-controls', () => ({ SignalLedgerControls: () => null }))

const activePlan = {
  plan: {
    id: 'plan-1',
    actions: [{
      id: 'action-1', title: 'Resolver el pago', nextStep: 'Validar el checkout.', explanation: 'Prueba.',
      confidence: 0.6, estimatedMinutes: 25, status: 'accepted', facts: ['Hay una tarea pendiente.'], inferences: ['Es el siguiente bloqueo.'],
    }],
  },
  staleActions: [],
}

describe('NovoLoopCard Calendar confirmation', () => {
  beforeEach(() => {
    Object.defineProperty(global.crypto, 'randomUUID', { configurable: true, value: jest.fn(() => 'calendar-request-id') })
    ;(global.fetch as jest.Mock) = jest.fn((url: string) => {
      if (url === '/api/cognitive/loop/plan') return Promise.resolve(new Response(JSON.stringify(activePlan), { status: 200 }))
      if (url === '/api/ai/activity/runs') return Promise.resolve(new Response(JSON.stringify({ run: null }), { status: 200 }))
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
    })
  })

  it('does not issue an external Calendar write until the user confirms it', async () => {
    const user = userEvent.setup()
    render(<NovoLoopCard />)

    await screen.findByText('Resolver el pago')
    await user.click(screen.getByRole('button', { name: 'Programar enfoque' }))

    expect(screen.getByText(/Crear este bloque de enfoque en Google Calendar/)).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalledWith('/api/cognitive/loop/calendar', expect.anything())

    await user.click(screen.getByRole('button', { name: 'Confirmar bloque' }))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      '/api/cognitive/loop/calendar',
      expect.objectContaining({ method: 'POST' }),
    ))
  })
})
