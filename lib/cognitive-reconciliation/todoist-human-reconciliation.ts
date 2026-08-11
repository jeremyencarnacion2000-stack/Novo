import { randomUUID } from 'node:crypto'
import {
  createAmbientReconciliationService,
  type AmbientReconciliationResult,
  type ReconciliationStore,
} from './ambient-reconciliation'

export type TodoistImportedTask = {
  id: string
  projectId: string
  text: string
  priority: 'low' | 'medium' | 'high'
  dueDate: Date | null
}

export type TodoistCompletionEvent = {
  eventId: string
  taskId: string
  projectId: string
  occurredAt: Date
}

export type TodoistHumanPullResult = {
  fetchedAt: Date
  cursorAfter: string
  activeTasks: TodoistImportedTask[]
  completions: TodoistCompletionEvent[]
}

export type TodoistOwnedConnection = {
  userId: string
  connectionId: string
  providerAccountId: string
  accessToken: string
  selectedProjectIds: string[]
  scopeKey: string
  cursor: string | null
  lastSuccessfulRunId: string | null
}

export type TodoistReconciliationStore = {
  loadOwnedConnection(userId: string): Promise<TodoistOwnedConnection | null>
  claimRun(connection: TodoistOwnedConnection, runId: string): Promise<boolean>
  bootstrap(input: {
    connection: TodoistOwnedConnection
    runId: string
    tasks: TodoistImportedTask[]
    cursorAfter: string
    fetchedAt: Date
  }): Promise<{ created: number; existing: number }>
  ambientStore(connection: TodoistOwnedConnection, runId: string): ReconciliationStore
  finishRun(input: {
    connection: TodoistOwnedConnection
    runId: string
    cursorAfter: string
    fetchedAt: Date
  }): Promise<void>
  abandonRun(connection: TodoistOwnedConnection, runId: string): Promise<void>
}

export type TodoistHumanReconciliationResult = {
  disposition: 'not_connected' | 'scope_required' | 'busy' | 'bootstrapped' | 'reconciled' | 'quarantined'
  runId?: string
  created?: number
  existing?: number
  projected?: number
  duplicate?: number
  results: AmbientReconciliationResult[]
  cursorAdvanced: boolean
}

export type TodoistPullSelectedProjects = (input: {
  accessToken: string
  projectIds: string[]
  cursor: string | null
}) => Promise<TodoistHumanPullResult>

type Dependencies = {
  store: TodoistReconciliationStore
  pullSelectedProjects: TodoistPullSelectedProjects
  newRunId?: () => string
}

function defaultRunId() {
  return randomUUID()
}

function noRun(disposition: 'not_connected' | 'scope_required' | 'busy'): TodoistHumanReconciliationResult {
  return { disposition, results: [], cursorAdvanced: false }
}

function isCursorSafe(result: AmbientReconciliationResult) {
  return result.disposition === 'projected'
    || result.disposition === 'duplicate'
    || result.disposition === 'stale'
}

export function createTodoistHumanReconciliationService({
  store,
  pullSelectedProjects,
  newRunId = defaultRunId,
}: Dependencies) {
  return async ({ userId }: { userId: string }): Promise<TodoistHumanReconciliationResult> => {
    const connection = await store.loadOwnedConnection(userId)
    if (!connection) return noRun('not_connected')
    if (connection.selectedProjectIds.length === 0) return noRun('scope_required')

    const selectedProjects = new Set(connection.selectedProjectIds)
    const runId = newRunId()
    if (!await store.claimRun(connection, runId)) return noRun('busy')

    try {
      const pulled = await pullSelectedProjects({
        accessToken: connection.accessToken,
        projectIds: [...connection.selectedProjectIds],
        cursor: connection.cursor,
      })

      if (!connection.cursor) {
        const scopedTasks = pulled.activeTasks.filter((task) => selectedProjects.has(task.projectId))
        const baseline = await store.bootstrap({
          connection,
          runId,
          tasks: scopedTasks,
          cursorAfter: pulled.cursorAfter,
          fetchedAt: pulled.fetchedAt,
        })
        return {
          disposition: 'bootstrapped',
          runId,
          ...baseline,
          results: [],
          cursorAdvanced: true,
        }
      }

      const reconcile = createAmbientReconciliationService({ store: store.ambientStore(connection, runId) })
      const results: AmbientReconciliationResult[] = []
      for (const event of pulled.completions) {
        if (!selectedProjects.has(event.projectId)) {
          results.push({
            disposition: 'confirmation_required',
            reason: 'outside_selected_scope',
            recommendationInvalidated: false,
            stalePlanDisposition: 'unchanged',
            learningEligible: false,
          })
          continue
        }
        results.push(await reconcile({ userId }, {
          userId,
          provider: 'todoist',
          connectionId: connection.connectionId,
          providerAccountId: connection.providerAccountId,
          source: 'manual_sync',
          sourceEventId: event.eventId,
          sourceEntityId: event.taskId,
          entityType: 'task',
          kind: 'completed',
          actor: 'provider_user',
          occurredAt: event.occurredAt,
          observedAt: event.occurredAt,
          fetchedAt: pulled.fetchedAt,
          syncRunId: runId,
          verification: 'verified_source_state',
          rawContentStored: false,
          metadata: { projectId: event.projectId },
        }))
      }

      if (results.every(isCursorSafe)) {
        await store.finishRun({ connection, runId, cursorAfter: pulled.cursorAfter, fetchedAt: pulled.fetchedAt })
        return {
          disposition: 'reconciled',
          runId,
          projected: results.filter((result) => result.disposition === 'projected').length,
          duplicate: results.filter((result) => result.disposition === 'duplicate').length,
          results,
          cursorAdvanced: true,
        }
      }

      await store.abandonRun(connection, runId)
      return {
        disposition: 'quarantined',
        runId,
        projected: results.filter((result) => result.disposition === 'projected').length,
        duplicate: results.filter((result) => result.disposition === 'duplicate').length,
        results,
        cursorAdvanced: false,
      }
    } catch (error) {
      await store.abandonRun(connection, runId)
      throw error
    }
  }
}
