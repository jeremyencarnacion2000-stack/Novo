import { mergeNovoActivityEvents, type NovoActivityPhase } from '@/lib/ai/activity-contract'

const event = (sequence: number, phase: NovoActivityPhase = 'planning') => ({ runId: 'run-1', sequence, phase, label: phase, timestamp: new Date(sequence).toISOString() })

describe('Novo activity contract recovery', () => {
  it('sorts out-of-order frames and ignores duplicates', () => {
    const result = mergeNovoActivityEvents([event(2)], [event(1), event(2), event(3)])
    expect(result.map((item) => item.sequence)).toEqual([1, 2, 3])
  })

  it('does not replace an already accepted sequence with a stale duplicate', () => {
    const result = mergeNovoActivityEvents([event(1, 'completed')], [event(1, 'planning')])
    expect(result[0].phase).toBe('completed')
  })
})
