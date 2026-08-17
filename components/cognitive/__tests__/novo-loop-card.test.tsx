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

describe('NovoLoopCard outcome controls', () => {
  beforeEach(() => {
    ;(global.fetch as jest.Mock) = jest.fn((url: string) => {
      if (url === '/api/cognitive/loop/plan') return Promise.resolve(new Response(JSON.stringify(activePlan), { status: 200 }))
      if (url === '/api/ai/activity/runs') return Promise.resolve(new Response(JSON.stringify({ run: null }), { status: 200 }))
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
    })
  })

  it('requires a structured reason before abandonment or failure can be submitted', async () => {
    const user = userEvent.setup()
    render(<NovoLoopCard />)

    await screen.findByText('Resolver el pago')
    const abandon = screen.getByRole('button', { name: 'Abandonar' })
    const failed = screen.getByRole('button', { name: 'Marcar fallida' })
    expect(abandon).toBeDisabled()
    expect(failed).toBeDisabled()

    await user.selectOptions(screen.getByRole('combobox'), 'too_large')
    await waitFor(() => expect(abandon).toBeEnabled())
    expect(failed).toBeEnabled()
  })

  it('plans against the objective created from this form', async () => {
    const user = userEvent.setup()
    ;(global.fetch as jest.Mock) = jest.fn((url: string) => {
      if (url === '/api/cognitive/loop/plan') return Promise.resolve(new Response(JSON.stringify({ plan: null, staleActions: [] }), { status: 200 }))
      if (url === '/api/ai/activity/runs') return Promise.resolve(new Response(JSON.stringify({ runId: 'run-1', run: null }), { status: 200 }))
      if (url === '/api/goals') return Promise.resolve(new Response(JSON.stringify({ id: 'goal-created-for-plan' }), { status: 200 }))
      if (url === '/api/cognitive/loop/checkin') return Promise.resolve(new Response(JSON.stringify({ snapshot: { id: 'snapshot-1' } }), { status: 200 }))
      return Promise.resolve(new Response(JSON.stringify(activePlan), { status: 201 }))
    })

    render(<NovoLoopCard />)
    await screen.findByRole('button', { name: 'Generar mi siguiente paso' })
    await user.type(screen.getByLabelText('Objetivo importante'), 'Terminar el flujo de pago')
    await user.click(screen.getByRole('button', { name: 'Generar mi siguiente paso' }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      '/api/cognitive/loop/plan',
      expect.objectContaining({ body: expect.stringContaining('goal-created-for-plan') }),
    ))
  })

  it('shows a bounded confidence label and its limitation', async () => {
    render(<NovoLoopCard />)

    await screen.findByText('Resolver el pago')
    expect(screen.getByText('Confianza')).toBeInTheDocument()
    expect(screen.getByText('Media')).toBeInTheDocument()
    expect(screen.getByText('Hay señales útiles, pero el contexto puede cambiar.')).toBeInTheDocument()
  })
})
