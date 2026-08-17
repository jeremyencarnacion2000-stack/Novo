import { randomUUID, createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { completeDurableTask } from '@/lib/cognitive/complete-durable-task'
import { createTodoistHumanReconciliationService, type TodoistReconciliationStore, type TodoistOwnedConnection, type TodoistPullSelectedProjects } from './todoist-human-reconciliation'
import type { ReconciliationStore, ReconciliationTransaction, OwnedConnectionLookup, ProjectionIdentity, ImportedEntityRecord, NovoExternalObservation, OrderingBasis, OrderingAssessment, LedgerSignalCreate, LedgerSignalRecord, ImportedEntityProjection, ActivityRunCreate, ActivityEventCreate } from './ambient-reconciliation'
import { normalizeTodoistTask } from '@/lib/todoist-deterministic-linking'
import { runAmbientTwinForUser } from '@/lib/cognitive/ambient-twin-runtime'

const blocked = new Set(['disconnected', 'revoked', 'reauth_required', 'error'])
const jsonRecord = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}

function createAmbientStore(connection: TodoistOwnedConnection, runId: string): ReconciliationStore {
  return { runAtomically: async (work) => prisma.$transaction(async (tx) => {
    const transaction: ReconciliationTransaction = {
      ownsConnection: async (input: OwnedConnectionLookup) => {
        const row = await tx.integrationAccount.findFirst({ where: { id: input.connectionId, userId: input.userId, provider: 'todoist', providerAccountId: input.providerAccountId } })
        return !!row && !blocked.has(String(row.syncStatus ?? '').toLowerCase())
      },
      isSourcePaused: async () => false,
      findLedgerByFingerprint: async (userId, fingerprint) => tx.novoSignalLedger.findUnique({ where: { userId_fingerprint: { userId, fingerprint } } }) as any,
      findOwnedImportedEntities: async (identity: ProjectionIdentity) => {
        const rows = await tx.externalEntityMapping.findMany({ where: { userId: identity.userId, provider: identity.provider, integrationAccountId: identity.connectionId, providerAccountId: identity.providerAccountId, entityType: identity.entityType, sourceEntityId: identity.sourceEntityId, status: 'active', internalType: 'task' } })
        return rows.map((row): ImportedEntityRecord => ({ id: row.id, userId: row.userId, provider: row.provider, connectionId: row.integrationAccountId, providerAccountId: row.providerAccountId, entityType: row.entityType, sourceEntityId: row.sourceEntityId, lifecycleState: 'active', lastExternalRevision: row.sourceRevision, lastSyncRunId: null }))
      },
      assessOrdering: async (entity, observation, basis): Promise<OrderingAssessment> => {
        if (basis === 'provider_revision') return { basis, relation: entity.lastExternalRevision === observation.externalRevision ? 'tied' : 'newer' }
        return { basis, relation: entity.lastSyncRunId === runId ? 'tied' : 'newer' }
      },
      createLedgerSignal: async (input: LedgerSignalCreate) => tx.novoSignalLedger.create({ data: input as any }) as any,
      projectImportedLifecycle: async (input: ImportedEntityProjection) => {
        const mapping = await tx.externalEntityMapping.findFirst({ where: { id: input.id, userId: input.userId, status: 'active' } })
        if (!mapping) throw new Error('mapping_not_owned')
        await tx.externalEntityMapping.update({ where: { id: mapping.id }, data: { sourceRevision: input.externalRevision, lastObservedAt: input.observedAt } })
        await tx.task.updateMany({ where: { id: mapping.internalId, userId: input.userId }, data: { status: 'done', version: { increment: 1 } } })
        return {
          id: mapping.id,
          userId: mapping.userId,
          provider: mapping.provider,
          connectionId: mapping.integrationAccountId,
          providerAccountId: mapping.providerAccountId,
          entityType: mapping.entityType,
          sourceEntityId: mapping.sourceEntityId,
          lifecycleState: 'completed',
          lastExternalRevision: input.externalRevision,
          lastSyncRunId: input.syncRunId,
        }
      },
      createActivityRun: async (input: ActivityRunCreate) => tx.aiActivityRun.create({ data: { id: input.id, userId: input.userId, surface: input.surface, phase: input.phase, sequence: input.sequence, status: input.status, startedAt: input.startedAt, completedAt: input.completedAt, expiresAt: input.expiresAt } }) as any,
      createActivityEvent: async (input: ActivityEventCreate) => tx.aiActivityEvent.create({ data: { id: input.id, runId: input.runId, sequence: input.sequence, phase: input.phase, label: input.label, detail: input.detail, timestamp: input.timestamp, requiresConfirmation: false, recoverable: false, terminal: true } }) as any,
    }
    return work(transaction)
  }) }
}

export function createTodoistPrismaReconciliationStore(): TodoistReconciliationStore {
  return {
    async loadOwnedConnection(userId) {
      const row = await prisma.integrationAccount.findFirst({ where: { userId, provider: 'todoist', providerAccountId: { not: null } } })
      if (!row || blocked.has(String(row.syncStatus ?? '').toLowerCase())) return null
      const metadata = jsonRecord(row.metadata); const projectIds = Array.isArray(metadata.selectedProjectIds) ? metadata.selectedProjectIds.filter((v): v is string => typeof v === 'string') : []
      return { userId, connectionId: row.id, providerAccountId: row.providerAccountId!, accessToken: row.accessToken, selectedProjectIds: projectIds, scopeKey: `todoist:${row.id}`, cursor: row.syncCursor, lastSuccessfulRunId: row.lastSyncRunId }
    },
    async claimRun(connection, runId) {
      const now = new Date(); const cutoff = new Date(now.getTime() - 5 * 60_000)
      const result = await prisma.integrationAccount.updateMany({ where: { id: connection.connectionId, userId: connection.userId, provider: 'todoist', OR: [{ lastAttemptAt: null }, { lastAttemptAt: { lt: cutoff } }] }, data: { lastAttemptAt: now, lastSyncRunId: runId, syncStatus: 'running', syncErrorCode: null, syncErrorMessage: null } })
      return result.count === 1
    },
    async bootstrap({ connection, runId, tasks, cursorAfter, fetchedAt }) {
      let created = 0; let existing = 0
      await prisma.$transaction(async (tx) => { for (const task of tasks) {
        const baseline = normalizeTodoistTask({ id: task.id, is_completed: false, updated_at: fetchedAt.toISOString(), project_id: task.projectId })
        const existingMap = await tx.externalEntityMapping.findFirst({ where: { userId: connection.userId, provider: 'todoist', providerAccountId: connection.providerAccountId, entityType: 'task', sourceEntityId: task.id, status: 'active' } })
        if (existingMap) { existing++; continue }
        const novo = await tx.task.create({ data: { userId: connection.userId, title: task.text, status: 'todo', priority: task.priority, dueDate: task.dueDate?.toISOString() ?? null, tags: '[]' } })
        const mapping = await tx.externalEntityMapping.create({ data: { userId: connection.userId, integrationAccountId: connection.connectionId, provider: 'todoist', providerAccountId: connection.providerAccountId, entityType: 'task', sourceEntityId: task.id, internalType: 'task', internalId: novo.id, status: 'active', canonicalBaseline: baseline as any, sourceRevision: baseline.providerUpdatedAt, lastObservedAt: fetchedAt } })
        await tx.externalEntityBaseline.create({ data: { mappingId: mapping.id, userId: connection.userId, provider: 'todoist', providerAccountId: connection.providerAccountId, sourceEntityId: task.id, normalizedState: baseline as any, stateHash: baseline.hash, observedAt: fetchedAt } }); created++
      } })
      return { created, existing }
    },
    ambientStore: (connection, runId) => createAmbientStore(connection, runId),
    async finishRun({ connection, runId, cursorAfter, fetchedAt }) { await prisma.integrationAccount.updateMany({ where: { id: connection.connectionId, userId: connection.userId, lastSyncRunId: runId }, data: { syncCursor: cursorAfter, syncCursorUpdatedAt: fetchedAt, lastSyncedAt: fetchedAt, lastSuccessfulSyncAt: fetchedAt, syncStatus: 'connected', lastAttemptAt: fetchedAt } }) },
    async abandonRun(connection, runId) { await prisma.integrationAccount.updateMany({ where: { id: connection.connectionId, userId: connection.userId, lastSyncRunId: runId }, data: { syncStatus: 'error', syncErrorCode: 'ambient_run_abandoned' } }) },
  }
}

export async function runTodoistAmbientSync(userId: string, pullSelectedProjects: TodoistPullSelectedProjects) {
  const service = createTodoistHumanReconciliationService({ store: createTodoistPrismaReconciliationStore(), pullSelectedProjects })
  const result = await service({ userId })
  if (result.disposition === 'reconciled') {
    // Completion outcomes/replans are processed separately and idempotently.
    for (const item of result.results.filter((r) => r.disposition === 'projected' && r.importedEntityId)) {
      const mapping = await prisma.externalEntityMapping.findUnique({ where: { id: item.importedEntityId }, select: { userId: true, internalId: true } })
      if (mapping) await completeDurableTask({ userId: mapping.userId, taskId: mapping.internalId, actor: 'agent', source: 'todoist_ambient' })
    }
    await runAmbientTwinForUser(userId, { trigger: 'task_completed' }).catch(() => undefined)
  }
  return result
}
