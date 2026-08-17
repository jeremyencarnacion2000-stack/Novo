import { render, screen } from '@testing-library/react'
import { CognitiveEngineWidget } from '../cognitive-engine-widget'

jest.mock('@/hooks/use-swr', () => ({
  useCognitiveEngine: () => ({
    isLoading: false,
    data: {
      success: true,
      report: {
        focusScore: 62,
        energyLevel: 'medium',
        burnoutRisk: 54,
        insights: [{ headline: 'Dos compromisos vencen hoy.' }],
        recommendation: 'Empieza por el compromiso con fecha mÃ¡s cercana.',
      },
    },
  }),
}))

jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ language: 'es' }) }))

describe('CognitiveEngineWidget', () => {
  it('uses the shared dashboard glass material so personalization controls its blur', () => {
    const { container } = render(<CognitiveEngineWidget />)

    expect(container.querySelector('.cognitive-engine-summary')).toHaveClass('glass-surface')
  })

  it('labels the workload value as a deterministic operational estimate, not a burnout diagnosis', () => {
    render(<CognitiveEngineWidget />)

    expect(screen.getByText(/carga operativa estimada/i)).toBeInTheDocument()
    expect(screen.queryByText(/agotamiento/i)).not.toBeInTheDocument()
  })
})
