import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import type { TodoistAmbientPorts } from './todoist-ambient-runner'

const blocked = ['revoked', 'reauth_required', 'error', 'disconnected']
const CLAIM_TTL_MS = 5 * 60_000

function laneKey(connectionId: string, lane: string) {
  return `todoist:ambient:${connectionId}:${lane}`
}

/** Prisma-backed persistence boundary for the server-only Todoist runner. */
export function createTodoistAmbientPrismaPorts(provider: Pick<TodoistAmbientPorts, 'discoverCandidates' | 'verifyTask'> & Partial<Pick<TodoistAmbientPorts, 'processReplan'>>): TodoistAmbientPorts {
  return {
    loadConnection: async (connectionId) => {
      const row = await prisma.integrationAccount.findFirst({
        where: { id: connectionId, provider: 'todoist', providerAccountId: { not: null }, accessToken: { not: '' }, syncStatus: { notIn: blocked } },
      })
      if (!row || !row.providerAccountId || blocked.includes(String(row.syncStatus ?? '').toLowerCase())) return null
      return { id: row.id, userId: row.userId, provider: row.provider, providerAccountId: row.providerAccountId, accessToken: row.accessToken, status: row.syncStatus }
    },
    claimRun: async ({ userId, connectionId, lane }) => {
      const now = new Date(); const expiry = new Date(now.getTime() + CLAIM_TTL_MS); const key = laneKey(connectionId, lane)
      const account = await prisma.integrationAccount.findFirst({ where: { id: connectionId, userId, provider: 'todoist', providerAccountId: { not: null } }, select: { providerAccountId: true } })
      if (!account?.providerAccountId) return { acquired: false }
      const existing = await prisma.ambientReconciliationClaim.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey: key } } })
      if (existing?.status === 'processing' && existing.claimExpiresAt && existing.claimExpiresAt > now) return { acquired: false }
      if (existing) {
        const takeover = await prisma.ambientReconciliationClaim.updateMany({ where: { id: existing.id, userId, OR: [{ status: { not: 'processing' } }, { claimExpiresAt: { lt: now } }, { claimExpiresAt: null }] }, data: { status: 'processing', attempts: { increment: 1 }, claimedAt: now, claimExpiresAt: expiry, failureCode: null, failedAt: null } })
        return takeover.count === 1 ? { acquired: true, claimId: existing.id } : { acquired: false }
      }
      try {
        const row = await prisma.ambientReconciliationClaim.create({ data: { userId, provider: 'todoist', providerAccountId: account.providerAccountId, entityType: 'sync_lane', sourceEntityId: lane, idempotencyKey: key, status: 'processing', attempts: 1, claimedAt: now, claimExpiresAt: expiry } })
        return { acquired: true, claimId: row.id }
      } catch (error) {
        if ((error as { code?: string }).code === 'P2002') return { acquired: false }
        throw error
      }
    },
    getCursor: async (connectionId) => {
      const row = await prisma.integrationAccount.findFirst({ where: { id: connectionId, provider: 'todoist' }, select: { syncCursor: true } })
      return row?.syncCursor ?? null
    },
    discoverCandidates: provider.discoverCandidates,
    verifyTask: provider.verifyTask,
    processReplan: provider.processReplan,
    mappings: async ({ userId, connectionId, providerAccountId, externalIds }) => {
      if (!externalIds.length) return []
      const rows = await prisma.externalEntityMapping.findMany({ where: { userId, integrationAccountId: connectionId, provider: 'todoist', providerAccountId, entityType: 'task', internalType: 'task', status: 'active', sourceEntityId: { in: externalIds } }, include: { baseline: true } })
      const tasks = await prisma.task.findMany({ where: { userId, id: { in: rows.map((r) => r.internalId) } }, select: { id: true } })
      const owned = new Set(tasks.map((t) => t.id))
      return rows.filter((r) => owned.has(r.internalId)).map((r) => ({ externalId: r.sourceEntityId, taskId: r.internalId, baselineHash: r.baseline?.stateHash ?? '', baselineState: String((r.baseline?.normalizedState as { state?: string } | null)?.state ?? 'ACTIVE') }))
    },
    completeClaim: async (claimId, result) => { await prisma.ambientReconciliationClaim.updateMany({ where: { id: claimId, status: 'processing' }, data: { status: 'completed', completedAt: new Date(), claimExpiresAt: null, failureMessage: JSON.stringify(result).slice(0, 2000) } }) },
    failClaim: async (claimId, errorCode) => { await prisma.ambientReconciliationClaim.updateMany({ where: { id: claimId, status: 'processing' }, data: { status: 'failed', failedAt: new Date(), claimExpiresAt: null, failureCode: errorCode.slice(0, 120) } }) },
    advanceCursor: async (connectionId, expectedCursor, cursor) => { await prisma.integrationAccount.updateMany({ where: { id: connectionId, provider: 'todoist', syncCursor: expectedCursor }, data: { syncCursor: cursor, syncCursorUpdatedAt: new Date(), lastSyncedAt: new Date(), lastSuccessfulSyncAt: new Date(), syncStatus: 'connected' } }) },
    observeTransition: async ({ userId, connectionId, externalId, taskId, from, to, revision }) => {
      const observationId = `todoist:${connectionId}:${externalId}:${revision ?? to}`
      const account = await prisma.integrationAccount.findFirst({ where: { id: connectionId, userId, provider: 'todoist' }, select: { providerAccountId: true } })
      if (!account?.providerAccountId) return { duplicate: true }
      try { await prisma.ambientReconciliationClaim.create({ data: { userId, provider: 'todoist', providerAccountId: account.providerAccountId, entityType: 'task_transition', sourceEntityId: externalId, sourceEventId: observationId, idempotencyKey: `transition:${observationId}`, providerRevision: revision, status: 'completed', completedAt: new Date() } }); return { duplicate: false } }
      catch (error) { if ((error as { code?: string }).code === 'P2002') return { duplicate: true }; throw error }
    },
    updateBaseline: async ({ connectionId, externalId, state, revision }) => {
      const mapping = await prisma.externalEntityMapping.findFirst({ where: { integrationAccountId: connectionId, provider: 'todoist', sourceEntityId: externalId, entityType: 'task', internalType: 'task', status: 'active' } })
      if (!mapping) return
      const normalizedState = { state, revision: revision ?? null }
      const stateHash = createHash('sha256').update(JSON.stringify(normalizedState)).digest('hex')
      await prisma.externalEntityBaseline.upsert({ where: { mappingId: mapping.id }, create: { mappingId: mapping.id, userId: mapping.userId, provider: mapping.provider, providerAccountId: mapping.providerAccountId, sourceEntityId: externalId, normalizedState, stateHash }, update: { normalizedState, stateHash, observedAt: new Date() } })
      await prisma.externalEntityMapping.update({ where: { id: mapping.id }, data: { sourceRevision: revision ?? mapping.sourceRevision, lastObservedAt: new Date(), canonicalBaseline: normalizedState } })
    },
  }
}

export function todoistObservationId(connectionId: string, externalId: string, revision: string | null | undefined, completedAt?: Date | null) {
  return `todoist:${connectionId}:${externalId}:${revision ?? completedAt?.toISOString() ?? 'completed'}`
}
