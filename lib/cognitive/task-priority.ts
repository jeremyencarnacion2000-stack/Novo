export type RankedTask = {
  id: string
  title: string
  status: string
  priority: string
  dueDate: string | null
  tags: string
}

/**
 * Deterministic and explainable queue ordering shared by Twin capabilities.
 * Explicit user priority is a floor; deadline proximity and active work may
 * elevate it, but the Twin must never silently demote a priority selected by
 * the user. Origin labels are not a behavioral signal and never affect rank.
 */
export function inferTaskPriority(task: RankedTask, now = new Date()) {
  const explicit = task.priority === 'high' ? 30 : task.priority === 'medium' ? 20 : 10
  const due = task.dueDate ? new Date(`${task.dueDate}T23:59:59Z`) : null
  const days = due ? Math.ceil((due.getTime() - now.getTime()) / 86_400_000) : null
  const urgency = days === null ? 0 : days < 0 ? 30 : days <= 1 ? 25 : days <= 2 ? 18 : days <= 7 ? 8 : 0
  const active = task.status === 'in-progress' ? 8 : 0
  const score = explicit + urgency + active
  const inferred = score >= 35 ? 'high' : score >= 18 ? 'medium' : 'low'

  if (task.priority === 'high') return 'high'
  if (task.priority === 'medium' && inferred === 'low') return 'medium'
  return inferred
}
