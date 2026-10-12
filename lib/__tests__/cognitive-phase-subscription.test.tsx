import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { CognitiveProvider, useCognitivePhase, useCognitiveState } from '../cognitive-context'

let mockPhase = 'LINEAR_EXECUTION'
let mockAttention = 70
const mockPhaseRender = jest.fn()

jest.mock('next/navigation', () => ({ usePathname: () => '/today' }))
jest.mock('next-auth/react', () => ({ useSession: () => ({ status: 'unauthenticated', data: null }) }))
jest.mock('@/lib/player-store', () => ({ usePlayerStore: (select: any) => select({ playPlaylist: jest.fn(), currentTrack: null }) }))
jest.mock('@/lib/morphing-engine', () => ({ startMorphTransition: (update: () => void) => update() }))
jest.mock('@/lib/sileo-bell', () => ({ sileo: { success: jest.fn(), info: jest.fn(), warning: jest.fn(), action: jest.fn() } }))
jest.mock('@/lib/cognitive-engine', () => ({
  COGNITIVE_PLAYLIST_QUERIES: {},
  computeBioState: () => ({
    phase: mockPhase, attentionScore: mockAttention, fatigueScore: 10,
    blueLight: false, recommendedAudioCategory: 'none', label: 'Execution Mode',
    minutesToNextPhase: 20, ultradianCycle: 1,
  }),
}))

function PhaseSurface() {
  const phase = useCognitivePhase()
  mockPhaseRender(phase)
  return <span data-testid="phase">{phase}</span>
}

function MetricsSurface() {
  return <span data-testid="attention">{useCognitiveState().bioState.attentionScore}</span>
}

describe('cognitive phase subscription', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockPhase = 'LINEAR_EXECUTION'
    mockAttention = 70
    mockPhaseRender.mockClear()
  })

  afterEach(() => jest.useRealTimers())

  it('updates live metrics without rendering phase surfaces until the phase changes', () => {
    const view = render(<CognitiveProvider><PhaseSurface /><MetricsSurface /></CognitiveProvider>)
    const initialRenders = mockPhaseRender.mock.calls.length

    mockAttention = 80
    act(() => { jest.advanceTimersByTime(300_000) })
    expect(screen.getByTestId('attention')).toHaveTextContent('80')
    expect(mockPhaseRender).toHaveBeenCalledTimes(initialRenders)

    mockPhase = 'PEAK_FOCUS'
    act(() => { jest.advanceTimersByTime(300_000) })
    expect(screen.getByTestId('phase')).toHaveTextContent('PEAK_FOCUS')
    expect(mockPhaseRender).toHaveBeenCalledTimes(initialRenders + 1)
    view.unmount()
  })
})
