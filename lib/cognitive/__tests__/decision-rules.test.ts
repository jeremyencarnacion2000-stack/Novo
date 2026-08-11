import { choosePrimaryRecommendation, deadlineUrgency } from '@/lib/cognitive/decision-rules'

const now = new Date('2026-07-30T12:00:00.000Z')

describe('Novo Loop deterministic decision rules', () => {
  it('prioritizes an overdue task above a newer medium-priority task', () => {
    const recommendation = choosePrimaryRecommendation({
      now, energy: 4, focus: 4, workload: 3, availableMinutes: 45, goal: null,
      recentlyDismissedTitles: [], recentlyPostponedTaskIds: [],
      tasks: [
        { id: 'current', title: 'Prepare update', priority: 'medium', dueDate: null, updatedAt: now, status: 'todo' },
        { id: 'overdue', title: 'Resolve payment review', priority: 'high', dueDate: '2026-07-29', updatedAt: now, status: 'todo' },
      ],
    })
    expect(recommendation?.taskId).toBe('overdue')
    expect(recommendation?.facts).toContain('Its deadline has passed.')
  })

  it('suppresses a recently dismissed recommendation instead of repeating it', () => {
    const recommendation = choosePrimaryRecommendation({
      now, energy: 4, focus: 4, workload: 3, availableMinutes: 45, goal: null,
      recentlyDismissedTitles: ['Resolve payment review'], recentlyPostponedTaskIds: [],
      tasks: [{ id: 'payment', title: 'Resolve payment review', priority: 'high', dueDate: '2026-07-29', updatedAt: now, status: 'todo' }],
    })
    expect(recommendation).toBeNull()
  })

  it('uses a shorter first step for low self-reported energy', () => {
    const recommendation = choosePrimaryRecommendation({
      now, energy: 1, focus: 2, workload: 4, availableMinutes: 90, goal: null,
      recentlyDismissedTitles: [], recentlyPostponedTaskIds: [],
      tasks: [{ id: 'task', title: 'Write product brief', priority: 'high', dueDate: null, updatedAt: now, status: 'todo' }],
    })
    expect(recommendation?.estimatedMinutes).toBe(15)
  })

  it('scores deadline proximity deterministically', () => {
    expect(deadlineUrgency('2026-07-29', now)).toBe(55)
    expect(deadlineUrgency('2026-07-30', now)).toBe(45)
    expect(deadlineUrgency('2026-08-20', now)).toBe(0)
  })

  it('downranks a recommendation marked unhelpful on the next plan', () => {
    const recommendation = choosePrimaryRecommendation({
      now, energy: 4, focus: 4, workload: 3, availableMinutes: 45, goal: null,
      recentlyDismissedTitles: [], recentlyPostponedTaskIds: [], recentlyUnhelpfulTitles: ['Review payment'],
      tasks: [
        { id: 'payment', title: 'Review payment', priority: 'medium', dueDate: null, updatedAt: now, status: 'todo' },
        { id: 'launch', title: 'Prepare launch', priority: 'medium', dueDate: null, updatedAt: now, status: 'todo' },
      ],
    })
    expect(recommendation?.taskId).toBe('launch')
  })

  it('elevates a neglected task with a deterministic, inspectable fact', () => {
    const recommendation = choosePrimaryRecommendation({
      now, energy: 4, focus: 4, workload: 3, availableMinutes: 45, goal: null,
      recentlyDismissedTitles: [], recentlyPostponedTaskIds: [],
      tasks: [
        { id: 'recent-low', title: 'Tidy notes', priority: 'low', dueDate: null, updatedAt: now, status: 'todo' },
        { id: 'inactive-medium', title: 'Clarify launch dependency', priority: 'medium', dueDate: null, updatedAt: new Date('2026-07-10T12:00:00.000Z'), status: 'todo' },
      ],
    })
    expect(recommendation?.taskId).toBe('inactive-medium')
    expect(recommendation?.facts.join(' ')).toContain('no recorded update for 20 days')
  })

  it('adapts the suggested action size to prior completed work', () => {
    const recommendation = choosePrimaryRecommendation({
      now, energy: 4, focus: 4, workload: 3, availableMinutes: 60, goal: null,
      recentlyDismissedTitles: [], recentlyPostponedTaskIds: [], preferredSuccessfulMinutes: 25,
      tasks: [{ id: 'task', title: 'Write product brief', priority: 'high', dueDate: null, updatedAt: now, status: 'todo' }],
    })
    expect(recommendation?.estimatedMinutes).toBe(25)
    expect(recommendation?.inferences.join(' ')).toContain('Previous completed steps')
  })

  it('uses a smaller step after the user reports that the recommendation was too large', () => {
    const recommendation = choosePrimaryRecommendation({
      now, energy: 4, focus: 4, workload: 3, availableMinutes: 60, goal: null,
      recentlyDismissedTitles: [], recentlyPostponedTaskIds: [], recentlyTooLargeTitles: ['Write product brief'],
      tasks: [{ id: 'task', title: 'Write product brief', priority: 'high', dueDate: null, updatedAt: now, status: 'todo' }],
    })
    expect(recommendation?.estimatedMinutes).toBe(15)
  })

  it('applies the persisted Twin adaptation policy to the next recommendation', () => {
    const recommendation = choosePrimaryRecommendation({
      now, energy: 4, focus: 4, workload: 3, availableMinutes: 60, goal: null,
      recentlyDismissedTitles: [], recentlyPostponedTaskIds: [],
      adaptationPolicy: {
        proposals: [
          { id: 'reduce_context_switching', behavior: 'one next step' },
          { id: 'keep_confirmation_boundary', behavior: 'confirm first' },
        ],
      },
      tasks: [{ id: 'task', title: 'Write product brief', priority: 'high', dueDate: null, updatedAt: now, status: 'todo' }],
    })
    expect(recommendation?.estimatedMinutes).toBe(15)
    expect(recommendation?.inferences.join(' ')).toContain('reduce context switching')
    expect(recommendation?.inferences.join(' ')).toContain('confirmation')
  })
})
