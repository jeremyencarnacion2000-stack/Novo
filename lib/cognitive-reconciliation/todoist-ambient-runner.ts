import { completeDurableTask } from '@/lib/cognitive/complete-durable-task'

export type TodoistAmbientTrigger = 'manual_internal' | 'scheduled' | 'recovery' | 'test'
export type TodoistCanonicalState = 'ACTIVE' | 'COMPLETED_VERIFIED' | 'DELETED_OR_UNKNOWN' | 'INACCESSIBLE' | 'PROVIDER_ERROR'

export type TodoistAmbientPorts = {
  loadConnection: (connectionId: string) => Promise<{ id: string; userId: string; provider: string; providerAccountId: string | null; accessToken: string | null; status?: string | null } | null>
  claimRun: (input: { userId: string; connectionId: string; providerAccountId?: string; lane: string }) => Promise<{ acquired: boolean; claimId?: string }>
  getCursor: (connectionId: string) => Promise<string | null>
  discoverCandidates: (input: { accessToken: string; cursor: string | null; overlapMinutes: number }) => Promise<{ ids: string[]; nextCursor: string | null }>
  verifyTask: (input: { accessToken: string; externalTaskId: string }) => Promise<{ state: TodoistCanonicalState; completedAt?: Date | null; revision?: string | null }>
  mappings: (input: { userId: string; connectionId: string; providerAccountId: string; externalIds: string[] }) => Promise<Array<{ externalId: string; taskId: string; baselineHash: string; baselineState: string }>>
  completeClaim: (claimId: string, result: Record<string, unknown>) => Promise<void>
  failClaim: (claimId: string, errorCode: string) => Promise<void>
  advanceCursor: (connectionId: string, expectedCursor: string | null, nextCursor: string | null) => Promise<void>
  observeTransition: (input: { userId: string; connectionId: string; providerAccountId?: string; externalId: string; taskId: string; from: string; to: string; revision?: string | null }) => Promise<{ duplicate: boolean }>
  updateBaseline: (input: { connectionId: string; externalId: string; state: string; revision?: string | null }) => Promise<void>
  processReplan?: (userId: string) => Promise<unknown>
}

/** Server-only bounded Todoist fallback. Provider facts end at completeDurableTask. */
export async function runTodoistAmbientSync(input: { connectionId: string; trigger: TodoistAmbientTrigger; ports: TodoistAmbientPorts }) {
  const { ports, connectionId } = input
  const connection = await ports.loadConnection(connectionId)
  if (!connection || connection.provider !== 'todoist' || !connection.providerAccountId || !connection.accessToken || ['revoked', 'reauth_required', 'error', 'disconnected'].includes(String(connection.status ?? '').toLowerCase())) return { skipped: 'ineligible' as const }
  const claim = await ports.claimRun({ userId: connection.userId, connectionId, providerAccountId: connection.providerAccountId, lane: 'todoist-ambient' })
  if (!claim.acquired || !claim.claimId) return { skipped: 'claimed' as const }
  try {
    const cursor = await ports.getCursor(connectionId)
    const discovered = await ports.discoverCandidates({ accessToken: connection.accessToken, cursor, overlapMinutes: 10 })
    const mapped = await ports.mappings({ userId: connection.userId, connectionId, providerAccountId: connection.providerAccountId, externalIds: discovered.ids })
    const reconciled: string[] = []
    for (const mapping of mapped) {
      const verified = await ports.verifyTask({ accessToken: connection.accessToken, externalTaskId: mapping.externalId })
      if (verified.state !== 'COMPLETED_VERIFIED' || mapping.baselineState === 'COMPLETED_VERIFIED') continue
      const observation = await ports.observeTransition({ userId: connection.userId, connectionId, providerAccountId: connection.providerAccountId, externalId: mapping.externalId, taskId: mapping.taskId, from: mapping.baselineState, to: verified.state, revision: verified.revision })
      if (!observation.duplicate) {
        await completeDurableTask({ userId: connection.userId, taskId: mapping.taskId, actor: 'human', source: 'todoist', observationId: `todoist:${connection.providerAccountId}:${mapping.externalId}:${verified.revision ?? verified.completedAt?.toISOString() ?? verified.state}`, occurredAt: verified.completedAt ?? undefined })
        if (ports.processReplan) await ports.processReplan(connection.userId)
        reconciled.push(mapping.taskId)
      }
      await ports.updateBaseline({ connectionId, externalId: mapping.externalId, state: verified.state, revision: verified.revision })
    }
    await ports.advanceCursor(connectionId, cursor, discovered.nextCursor)
    await ports.completeClaim(claim.claimId, { reconciled, trigger: input.trigger })
    return { processed: true as const, reconciled }
  } catch (error) {
    await ports.failClaim(claim.claimId, error instanceof Error ? error.message : 'todoist_ambient_failed')
    return { processed: true as const, failed: true as const }
  }
}
