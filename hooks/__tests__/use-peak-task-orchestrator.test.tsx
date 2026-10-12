/** @jest-environment jsdom */

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))
jest.mock('@/lib/cognitive-context', () => ({
  useCognitiveEngine: jest.fn(),
}))
jest.mock('@/lib/focus-context', () => ({
  useFocusControls: jest.fn(),
}))
jest.mock('@/lib/cognitive-twin-context', () => ({
  useCognitiveTwin: jest.fn(),
}))
jest.mock('@/components/ContextHub', () => ({
  emitTwinNotification: jest.fn(),
}))

import { renderHook, waitFor } from '@testing-library/react'
import { useCognitiveEngine } from '@/lib/cognitive-context'
import { useFocusControls } from '@/lib/focus-context'
import { useCognitiveTwin } from '@/lib/cognitive-twin-context'
import { usePeakTaskOrchestrator } from '../use-peak-task-orchestrator'

const engine = useCognitiveEngine as jest.Mock
const focus = useFocusControls as jest.Mock
const twin = useCognitiveTwin as jest.Mock

function state(phase: 'PEAK_FOCUS' | 'LINEAR_EXECUTION') {
  return {
    phase,
    attentionScore: 72,
    minutesToNextPhase: 20,
    recommendedAudioCategory: 'ambient',
    fatigueScore: 24,
  }
}

describe('usePeakTaskOrchestrator', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    focus.mockReturnValue({
      addTask: jest.fn(),
      setSelectedTaskId: jest.fn(),
      setMode: jest.fn(),
    })
    twin.mockReturnValue({ twin: { userId: 'user-1', objective: 'Ship the release' } })
    engine.mockReturnValue({ bioState: state('PEAK_FOCUS') })
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/tasks')) return new Response(JSON.stringify([]), { status: 200 })
      if (url.includes('/api/onboarding/day-plan')) {
        return new Response(JSON.stringify({ tasks: [{ id: 'generated-task', title: 'Ship the release', priority: 'high' }] }), { status: 200 })
      }
      if (url.includes('/api/cognitive/patterns') || url.includes('/api/cognitive/decisions')) {
        return new Response(JSON.stringify([]), { status: 200 })
      }
      return new Response('{}', { status: 200 })
    }) as jest.Mock
  })

  it('generates a calibrated plan when a peak window has no pending tasks', async () => {
    const { result, rerender } = renderHook(() => usePeakTaskOrchestrator())

    // The first read establishes the baseline. A later transition into the
    // peak window is the one that should orchestrate tasks.
    engine.mockReturnValue({ bioState: state('LINEAR_EXECUTION') })
    rerender()
    engine.mockReturnValue({ bioState: state('PEAK_FOCUS') })
    rerender()

    await waitFor(() => expect(result.current.focusQueue).toHaveLength(1))
    expect(result.current.focusQueue[0]).toEqual(expect.objectContaining({ id: 'generated-task' }))
    expect(result.current.insight?.message).toContain('generé un plan calibrado')
    expect(global.fetch).toHaveBeenCalledWith('/api/onboarding/day-plan', expect.objectContaining({ method: 'POST' }))
  })

  it('keeps a real task queue when pending tasks exist', async () => {
    ;(global.fetch as jest.Mock).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/tasks')) return new Response(JSON.stringify([{ id: 'existing-task', title: 'Existing', priority: 'high' }]), { status: 200 })
      if (url.includes('/api/cognitive/patterns') || url.includes('/api/cognitive/decisions')) return new Response(JSON.stringify([]), { status: 200 })
      return new Response('{}', { status: 200 })
    })

    const { result, rerender } = renderHook(() => usePeakTaskOrchestrator())
    engine.mockReturnValue({ bioState: state('LINEAR_EXECUTION') })
    rerender()
    engine.mockReturnValue({ bioState: state('PEAK_FOCUS') })
    rerender()

    await waitFor(() => expect(result.current.focusQueue).toHaveLength(1))
    expect(result.current.focusQueue[0].id).toBe('existing-task')
    expect(global.fetch).not.toHaveBeenCalledWith('/api/onboarding/day-plan', expect.anything())
  })
})
