import crypto from 'node:crypto'

export type TodoistTask = { id: string; is_completed?: boolean; completed_at?: string | null; updated_at?: string | null; project_id?: string | null }
export type CanonicalTask = { sourceEntityId: string; completion: 'pending' | 'completed'; completedAt: string | null; providerUpdatedAt: string | null; projectId: string | null; hash: string }
export function normalizeTodoistTask(task: TodoistTask): CanonicalTask {
  if (!task || typeof task.id !== 'string' || typeof task.is_completed !== 'boolean') throw new Error('Malformed Todoist task')
  const value = { sourceEntityId: task.id, completion: task.is_completed ? 'completed' as const : 'pending' as const, completedAt: task.completed_at ?? null, providerUpdatedAt: task.updated_at ?? null, projectId: task.project_id ?? null }
  return { ...value, hash: crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex') }
}
export type LinkPorts = {
  getConnection: (userId: string, connectionId: string) => Promise<{ id: string; userId: string; provider: string; providerAccountId: string; status?: string } | null>
  fetchTask: (connection: unknown, taskId: string) => Promise<TodoistTask | null>
  ownsTarget: (userId: string, internalType: string, internalId: string) => Promise<boolean>
  findActive: (input: { userId: string; providerAccountId: string; sourceEntityId: string }) => Promise<{ internalType: string; internalId: string } | null>
  saveMapping: (input: Record<string, unknown>) => Promise<unknown>
  updateMapping: (input: Record<string, unknown>) => Promise<unknown>
}
export async function linkTodoistTask(input: { userId: string; connectionId: string; taskId: string; internalType: string; internalId: string }, ports: LinkPorts) {
  const c = await ports.getConnection(input.userId, input.connectionId)
  if (!c || c.userId !== input.userId || c.provider !== 'todoist' || c.status === 'disconnected') throw new Error('Owned Todoist connection required')
  if (!await ports.ownsTarget(input.userId, input.internalType, input.internalId)) throw new Error('Target not owned')
  const existing = await ports.findActive({ userId: input.userId, providerAccountId: c.providerAccountId, sourceEntityId: input.taskId })
  if (existing && (existing.internalType !== input.internalType || existing.internalId !== input.internalId)) throw new Error('Active mapping conflict')
  const task = await ports.fetchTask(c, input.taskId)
  if (!task) throw new Error('Todoist task unavailable')
  const baseline = normalizeTodoistTask(task)
  if (existing) return { idempotent: true, baseline }
  await ports.saveMapping({ ...input, provider: 'todoist', providerAccountId: c.providerAccountId, entityType: 'task', sourceEntityId: task.id, status: 'active', canonicalBaseline: baseline, sourceRevision: baseline.providerUpdatedAt, lastObservedAt: new Date() })
  return { idempotent: false, baseline }
}
export async function unlinkTodoistTask(input: { mappingId: string; reason: string }, ports: Pick<LinkPorts, 'updateMapping'>) {
  return ports.updateMapping({ id: input.mappingId, status: 'unlinked', unlinkReason: input.reason, unlinkedAt: new Date() })
}
export async function rejectTodoistTask(input: { mappingId: string; reason: string }, ports: Pick<LinkPorts, 'updateMapping'>) {
  return ports.updateMapping({ id: input.mappingId, status: 'quarantined', correctionReason: input.reason, correctedAt: new Date() })
}
