import { render, screen } from '@testing-library/react'
import { NovoThinkingOrb, novoPhaseToOrbState } from '@/components/ai/novo-thinking-orb'

jest.mock('thinking-orbs', () => ({
  ThinkingOrb: ({ state, paused, 'aria-label': label }: { state: string; paused: boolean; 'aria-label'?: string }) => (
    <canvas data-testid="thinking-orb" data-state={state} data-paused={String(paused)} aria-label={label} />
  ),
}))

describe('NovoThinkingOrb', () => {
  it('maps real activity phases to package states', () => {
    expect(novoPhaseToOrbState.retrieving_context).toBe('searching')
    expect(novoPhaseToOrbState.awaiting_confirmation).toBe('listening')
    expect(novoPhaseToOrbState.composing_response).toBe('composing')
  })

  it('renders a connecting state after transport loss', () => {
    render(<NovoThinkingOrb phase="planning" status="disconnected" label="Reconectando" />)
    expect(screen.getByTestId('thinking-orb')).toHaveAttribute('data-state', 'connecting')
  })

  it('does not animate terminal runs', () => {
    render(<NovoThinkingOrb phase="completed" status="completed" label="Plan listo" />)
    expect(screen.queryByTestId('thinking-orb')).toBeNull()
    expect(screen.getByRole('img', { name: 'Plan listo' })).toBeInTheDocument()
  })

  it('pauses ambient motion when reduced motion is enabled', () => {
    const original = window.matchMedia
    window.matchMedia = jest.fn().mockReturnValue({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() }) as typeof window.matchMedia
    render(<NovoThinkingOrb phase="planning" status="active" label="Preparando" />)
    expect(screen.getByTestId('thinking-orb')).toHaveAttribute('data-paused', 'true')
    window.matchMedia = original
  })
})
