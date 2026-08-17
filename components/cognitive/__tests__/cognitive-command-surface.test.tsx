import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CognitiveCommandSurface } from '../cognitive-command-surface'

const snapshot = {
  id: 'snapshot-1', generatedAt: '2026-08-04T00:00:00.000Z', policyVersion: 'cognitive-policy-v2', lens: 'now',
  nodes: [
    { id: 'twin:1', kind: 'twin', label: 'Tu Gemelo', summary: 'Contexto', relevance: 1, confidence: 'high', evidenceIds: [], actionIds: [], createdAt: '', updatedAt: '', isInferred: false, isCorrectable: false, isExcluded: false, isStale: false, position: { x: .5, y: .5 } },
    { id: 'signal:1', kind: 'signal', label: 'Pago pendiente', summary: 'checkout', relevance: .8, confidence: 'high', evidenceIds: ['evidence:s1'], actionIds: [], createdAt: '', updatedAt: '', isInferred: false, isCorrectable: true, isExcluded: false, isStale: false, position: { x: .7, y: .5 } },
  ],
  edges: [], evidence: [{ id: 'evidence:s1', sourceId: 'invoice-1', sourceType: 'calendar', classification: 'observed', observedAt: '2026-08-08T00:00:00.000Z', reliability: 'high', userConfirmed: false, label: 'Recibo de pago registrado' }], changes: { addedNodeIds: [], changedNodeIds: [], removedNodeIds: [] },
  recommendation: { id: 'a1', title: 'Resolver el pago', nextStep: 'Validar checkout', rationale: 'Bloquea el lanzamiento', actionLabel: 'Comenzar', confidence: 'high', facts: ['Hay un pago pendiente'], inferences: ['Es el siguiente bloqueo'], evidenceIds: [], actionId: 'a1' },
}

describe('CognitiveCommandSurface', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }))
    ;(global.fetch as jest.Mock) = jest.fn((url: string) => {
      if (url.startsWith('/api/cognitive/graph')) return Promise.resolve(new Response(JSON.stringify({ snapshot }), { status: 200 }))
      if (url === '/api/cognitive/agent-actions') return Promise.resolve(new Response(JSON.stringify({ proposals: [{ id: 'reduce_context_switching', reason: 'Fricción observada', behavior: 'Proponer un único siguiente paso' }], twin: { confidenceScore: 64, trustLevel: 'learning' } }), { status: 200 }))
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
    })
  })

  it('loads one snapshot and filters the accessible context list', async () => {
    const user = userEvent.setup()
    render(<CognitiveCommandSurface />)
    await screen.findAllByText('Resolver el pago')
    const search = screen.getByPlaceholderText('Buscar contexto')
    await user.type(search, 'pago')
    await waitFor(() => expect(screen.getAllByText('Pago pendiente').length).toBeGreaterThan(0))
    expect(screen.queryByText('Tu Gemelo')).not.toBeInTheDocument()
  })

  it('renders confirmation-gated Twin adaptations from the backend', async () => {
    render(<CognitiveCommandSurface />)
    await screen.findAllByText('Resolver el pago')
    expect(await screen.findByText('El Twin propone ajustar su comportamiento')).toBeInTheDocument()
    expect(screen.getByText('Proponer un único siguiente paso')).toBeInTheDocument()
    expect(screen.getByText('Confirmación requerida')).toBeInTheDocument()
  })

  it('shows the bounded current cognitive field in the first desktop content block', async () => {
    render(<CognitiveCommandSurface />)
    await screen.findAllByText('Resolver el pago')

    expect(screen.getByTestId('cognitive-heading')).toHaveClass('order-1')
    expect(screen.getByTestId('twin-context-card')).toHaveClass('order-3')
    expect(screen.getByTestId('cognitive-identity')).toHaveClass('order-4')
    expect(await screen.findByTestId('twin-context-field')).toBeInTheDocument()
    expect(screen.getAllByText('Contexto actual').length).toBeGreaterThan(0)
  })

  it('supports lens switching, node inspection and signal exclusion', async () => {
    const user = userEvent.setup()
    render(<CognitiveCommandSurface />)

    await screen.findAllByText('Resolver el pago')
    const objectivesTab = screen.getByRole('tab', { name: 'Objetivos' })
    await user.click(objectivesTab)
    expect(objectivesTab).toHaveAttribute('aria-selected', 'true')

    const signalButton = screen.getByRole('button', { name: 'Pago pendiente checkout' })
    await user.click(signalButton)
    expect(document.querySelector('[data-slot="sheet-overlay"]')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Inspect' }))
    expect(screen.getAllByText('Confianza').length).toBeGreaterThan(0)
    expect(screen.getAllByText('checkout').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Recibo de pago registrado').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Hecho').length).toBeGreaterThan(0)

    const excludeButtons = screen.getAllByRole('button', { name: 'Excluir esta señal' })
    const exclude = excludeButtons[excludeButtons.length - 1]
    await user.click(exclude)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/cognitive/loop/signals', expect.objectContaining({ method: 'POST' })))
    expect(screen.getAllByText('Pago pendiente').length).toBeGreaterThan(0)
  })

  it('persists a user correction from the contextual correction sheet', async () => {
    const user = userEvent.setup()
    render(<CognitiveCommandSurface />)

    await screen.findAllByText('Resolver el pago')
    await user.click(screen.getByRole('button', { name: 'Pago pendiente checkout' }))
    await user.click(screen.getByRole('button', { name: 'Inspect' }))
    const correctionButtons = screen.getAllByRole('button', { name: 'Corregir esta señal' })
    await user.click(correctionButtons[correctionButtons.length - 1])
    await screen.findByRole('heading', { name: 'Corrige la comprensión de Novo' })
    await user.click(screen.getByRole('button', { name: 'Guardar corrección' }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/cognitive/loop/signals', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('user_corrected_from_cognitive_identity'),
    })))
  })

  it('keeps the node inspector as a bottom sheet on mobile', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
    const user = userEvent.setup()
    render(<CognitiveCommandSurface />)

    await screen.findAllByText('Resolver el pago')
    await user.click(screen.getByRole('button', { name: 'Pago pendiente checkout' }))
    await user.click(screen.getByRole('button', { name: 'Inspect' }))

    expect(document.querySelector('[data-slot="sheet-overlay"]')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Detalle del contexto' })).toBeInTheDocument()
  })

  it('replaces the field with a human-readable evidence dossier for Why', async () => {
    const user = userEvent.setup()
    render(<CognitiveCommandSurface />)

    await screen.findAllByText('Resolver el pago')
    await user.click(screen.getByRole('button', { name: 'Pago pendiente checkout' }))
    await user.click(screen.getByRole('button', { name: 'Why' }))

    expect(screen.getByTestId('twin-why-dossier')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Why Novo thinks this' })).toBeInTheDocument()
    expect(screen.getByText('Evidencia que lo respalda')).toBeInTheDocument()
    expect(screen.queryByTestId('twin-context-field')).not.toBeInTheDocument()
  })
})
