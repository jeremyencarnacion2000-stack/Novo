export type CandidateTask = {
  id: string
  title: string
  priority: string
  dueDate?: string | null
  updatedAt: Date
  status: string
}

export type OperationalContext = {
  now: Date
  energy: number
  focus: number
  availableMinutes: number
  workload: number
  goal?: { id: string; title: string; deadline?: string | null } | null
  tasks: CandidateTask[]
  recentlyDismissedTitles: string[]
  recentlyPostponedTaskIds: string[]
  recentlyUnhelpfulTitles?: string[]
  recentlyIntrusiveTitles?: string[]
  recentlyTooLargeTitles?: string[]
  recentlyTimeLimitedTitles?: string[]
  // Derived only from prior completed recommendations; never a guessed score.
  preferredSuccessfulMinutes?: number | null
  adaptationPolicy?: {
    proposals: Array<{ id: string; behavior?: string; reason?: string }>
  }
}

export type DeterministicRecommendation = {
  taskId?: string
  title: string
  nextStep: string
  estimatedMinutes: number
  confidence: number
  facts: string[]
  inferences: string[]
  explanation: string
  score: number
}

const priorityWeight: Record<string, number> = { high: 30, medium: 15, low: 5 }

function daysUntil(value: string | null | undefined, now: Date) {
  if (!value) return null
  const due = new Date(value)
  if (Number.isNaN(due.getTime())) return null
  return Math.ceil((due.getTime() - now.getTime()) / 86_400_000)
}

export function deadlineUrgency(dueDate: string | null | undefined, now: Date) {
  const days = daysUntil(dueDate, now)
  if (days === null) return 0
  if (days < 0) return 55
  if (days === 0) return 45
  if (days <= 2) return 30
  if (days <= 7) return 12
  return 0
}

// A task that has not changed for a while can indicate a blocked dependency
// or ambiguity. This is an observed timestamp, not a claim about the user.
export function inactivityPriority(updatedAt: Date, now: Date) {
  const elapsedDays = Math.floor((now.getTime() - updatedAt.getTime()) / 86_400_000)
  if (!Number.isFinite(elapsedDays) || elapsedDays < 14) return 0
  if (elapsedDays >= 30) return 18
  return 12
}

export function calculateConfidence(context: OperationalContext, task?: CandidateTask) {
  const stateCompleteness = [context.energy, context.focus, context.workload].filter(Boolean).length / 3
  const taskEvidence = task ? 0.2 : 0
  const deadlineEvidence = task && deadlineUrgency(task.dueDate, context.now) > 0 ? 0.15 : 0
  return Math.min(0.9, Math.round((0.35 + stateCompleteness * 0.2 + taskEvidence + deadlineEvidence) * 100) / 100)
}

export function choosePrimaryRecommendation(context: OperationalContext): DeterministicRecommendation | null {
  const adaptationIds = new Set(context.adaptationPolicy?.proposals.map((proposal) => proposal.id) ?? [])
  const reduceContextSwitching = adaptationIds.has('reduce_context_switching')
  const respectPeakWindow = adaptationIds.has('respect_peak_window')
  const keepConfirmationBoundary = adaptationIds.has('keep_confirmation_boundary')
  const useValidatedPattern = adaptationIds.has('use_validated_pattern')
  const candidates = context.tasks
    .filter((task) => task.status !== 'done')
    .filter((task) => !context.recentlyDismissedTitles.includes(task.title))
    .map((task) => {
      const overdueOrDue = deadlineUrgency(task.dueDate, context.now)
      const inactivity = inactivityPriority(task.updatedAt, context.now)
      const postponed = context.recentlyPostponedTaskIds.includes(task.id) ? 18 : 0
      const unhelpful = context.recentlyUnhelpfulTitles?.includes(task.title) ? 25 : 0
      const intrusive = context.recentlyIntrusiveTitles?.includes(task.title) ? 35 : 0
      const changedSize = context.recentlyTooLargeTitles?.includes(task.title) ? 8 : 0
      const timeLimited = context.recentlyTimeLimitedTitles?.includes(task.title) ? 5 : 0
      const lowEnergyPenalty = context.energy <= 2 && task.priority === 'high' ? 12 : 0
      const contextSwitchingPenalty = reduceContextSwitching && task.priority !== 'high' ? 4 : 0
      return { task, score: (priorityWeight[task.priority] ?? 10) + overdueOrDue + inactivity + postponed - lowEnergyPenalty - unhelpful - intrusive - changedSize - timeLimited - contextSwitchingPenalty }
    })
    .sort((a, b) => b.score - a.score)

  const selected = candidates[0]
  if (!selected) {
    if (!context.goal) return null
    return {
      title: `Define the next move for ${context.goal.title}`,
      nextStep: 'Write one concrete action that can be completed in the time you have available.',
      estimatedMinutes: Math.min(context.availableMinutes, 15),
      confidence: 0.45,
      facts: ['There are no unfinished tasks linked to the current operating context.'],
      inferences: [
        'A small planning action may reduce ambiguity before new work is added.',
        ...(keepConfirmationBoundary ? ['The Twin is still calibrating, so this suggestion remains behind the confirmation boundary.'] : []),
      ],
      explanation: 'Novo has insufficient task evidence, so it is proposing a short planning action rather than inventing work.',
      score: 1,
    }
  }

  const dueInDays = daysUntil(selected.task.dueDate, context.now)
  const facts = [
    `This task is marked ${selected.task.priority} priority.`,
    ...(dueInDays === null ? [] : [dueInDays < 0 ? 'Its deadline has passed.' : dueInDays === 0 ? 'It is due today.' : `It is due in ${dueInDays} day${dueInDays === 1 ? '' : 's'}.`]),
    `You reported ${context.availableMinutes} minutes available and focus ${context.focus}/5.`,
    ...(inactivityPriority(selected.task.updatedAt, context.now) > 0 ? [`This task has had no recorded update for ${Math.floor((context.now.getTime() - selected.task.updatedAt.getTime()) / 86_400_000)} days.`] : []),
  ]
  const feedbackSuggestsSmallStep = context.recentlyTooLargeTitles?.includes(selected.task.title) || context.recentlyTimeLimitedTitles?.includes(selected.task.title)
  const defaultEstimate = context.energy <= 2 || context.focus <= 2 || feedbackSuggestsSmallStep || reduceContextSwitching ? 15 : 45
  const learnedEstimate = context.preferredSuccessfulMinutes && context.preferredSuccessfulMinutes >= 5
    ? Math.min(context.preferredSuccessfulMinutes, 90)
    : defaultEstimate
  const estimate = Math.min(learnedEstimate, context.availableMinutes)
  const inferences = [
      context.energy <= 2 || context.focus <= 2 || feedbackSuggestsSmallStep
      ? 'A short first step is more likely to be executable with the current self-reported state.'
      : context.preferredSuccessfulMinutes
        ? `Previous completed steps suggest a ${estimate}-minute working block is a practical starting point.`
        : 'The current self-reported state supports a focused working block.',
      ...(reduceContextSwitching ? ['Adaptation applied: keep one concrete next step and reduce context switching.'] : []),
      ...(respectPeakWindow ? ['Adaptation applied: prefer the Twin\'s observed peak window when scheduling the next block.'] : []),
      ...(useValidatedPattern ? ['A previously validated Twin pattern was used as context, not as a fact.'] : []),
      ...(keepConfirmationBoundary ? ['The recommendation remains subject to user confirmation before action.'] : []),
  ]

  return {
    taskId: selected.task.id,
    title: selected.task.title,
    nextStep: `Work on “${selected.task.title}” for ${estimate} minutes, then record whether the next step is complete.`,
    estimatedMinutes: estimate,
    confidence: calculateConfidence(context, selected.task),
    facts,
    inferences,
    explanation: `${facts[0]} ${facts[1] ?? ''} ${inferences[0]}`.trim(),
    score: selected.score,
  }
}
