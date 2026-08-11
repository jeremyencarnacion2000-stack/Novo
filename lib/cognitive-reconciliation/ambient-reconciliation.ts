import { createHash } from 'node:crypto'

export type CanonicalObservationVerification =
  | 'verified_source_state'
  | 'signed_webhook'
  | 'deterministic_match'
  | 'unverified'
  | 'inferred'

export type NovoExternalObservation = {
  userId: string
  provider: string
  connectionId: string
  providerAccountId: string
  source: string
  sourceEventId: string
  sourceEntityId: string
  entityType: string
  kind: string
  actor: string
  occurredAt: Date
  observedAt: Date
  verification: CanonicalObservationVerification
  rawContentStored: boolean
  metadata: Readonly<{
    recommendedActionId?: string
    sourceRef?: string
    [key: string]: unknown
  }>
}

export type ReconciliationCaller = { userId: string }

export type OwnedConnectionLookup = {
  userId: string
  provider: string
  connectionId: string
  providerAccountId: string
}

export type RecommendedActionRecord = {
  id: string
  userId: string
  planId: string
  taskId: string | null
  status: string
}

export type LedgerSignalCreate = {
  userId: string
  fingerprint: string
  source: string
  sourceRef: string
  signalType: string
  label: string
  observedAt: Date
  reliability: 'deterministic'
}

export type LedgerSignalRecord = LedgerSignalCreate & { id: string }

export type RecommendedActionUpdate = {
  id: string
  userId: string
  data: {
    status: 'completed'
    statusAt: Date
    completedAt: Date
    responseAt: Date
    terminalReason: string
    lastActor: string
  }
}

export type OutcomeEventCreate = {
  userId: string
  planId: string
  recommendedActionId: string
  type: 'completed'
  metadata: Record<string, unknown>
  idempotencyKey: string
}

export type OutcomeEventRecord = OutcomeEventCreate & { id: string }

export type ActivityRunCreate = {
  id: string
  userId: string
  surface: 'novo_loop'
  phase: 'completed'
  sequence: 1
  status: 'completed'
  startedAt: Date
  completedAt: Date
  expiresAt: Date
  resultRef: string
  resultSummary: string
}

export type ActivityEventCreate = {
  id: string
  runId: string
  sequence: 1
  phase: 'completed'
  label: string
  detail: string
  timestamp: Date
  requiresConfirmation: false
  recoverable: false
  terminal: true
}

export type ReconciliationTransaction = {
  ownsConnection(input: OwnedConnectionLookup): Promise<boolean>
  isSourcePaused(userId: string, source: string): Promise<boolean>
  findLedgerByFingerprint(userId: string, fingerprint: string): Promise<LedgerSignalRecord | null>
  findLatestCompletionSignal(userId: string, source: string, sourceRef: string, signalType: string): Promise<LedgerSignalRecord | null>
  findLinkedRecommendedActions(userId: string, recommendedActionId?: string, sourceRef?: string): Promise<RecommendedActionRecord[]>
  createLedgerSignal(input: LedgerSignalCreate): Promise<LedgerSignalRecord>
  completeRecommendedAction(input: RecommendedActionUpdate): Promise<RecommendedActionRecord>
  createOutcomeEvent(input: OutcomeEventCreate): Promise<OutcomeEventRecord>
  createActivityRun(input: ActivityRunCreate): Promise<ActivityRunCreate>
  createActivityEvent(input: ActivityEventCreate): Promise<ActivityEventCreate>
}

export type ReconciliationStore = {
  runAtomically<T>(work: (transaction: ReconciliationTransaction) => Promise<T>): Promise<T>
}

export type AmbientReconciliationResult = {
  disposition: 'completed' | 'duplicate' | 'stale' | 'confirmation_required' | 'ignored' | 'rejected'
  reason?: string
  recommendationId?: string
  ledgerSignalId?: string
  outcomeEventId?: string
  activityRunId?: string
  recommendationInvalidated: boolean
  learningEligible: false
}

export type AmbientReconciliationDependencies = {
  store: ReconciliationStore
  now?: () => Date
}

const canonicalCompletionVerification = new Set<CanonicalObservationVerification>([
  'verified_source_state',
  'signed_webhook',
  'deterministic_match',
])

function baseResult(
  disposition: AmbientReconciliationResult['disposition'],
  reason?: string,
): AmbientReconciliationResult {
  return {
    disposition,
    ...(reason ? { reason } : {}),
    recommendationInvalidated: false,
    learningEligible: false,
  }
}

/**
 * The fingerprint deliberately excludes receive-time fields and arbitrary
 * metadata. A provider event remains the same delivery when it is replayed at
 * a later time or its JSON key order changes.
 */
export function externalObservationFingerprint(observation: NovoExternalObservation) {
  return createHash('sha256').update(JSON.stringify([
    observation.userId,
    observation.provider,
    observation.connectionId,
    observation.providerAccountId,
    observation.source,
    observation.sourceEventId,
    observation.entityType,
    observation.sourceEntityId,
    observation.kind,
  ])).digest('hex')
}

function completionSignalType(entityType: string) {
  const safeEntityType = entityType.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_') || 'entity'
  return `external_${safeEntityType}_completed`
}

function isUniqueClaimConflict(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

export function createAmbientReconciliationService({ store, now = () => new Date() }: AmbientReconciliationDependencies) {
  return async (caller: ReconciliationCaller, observation: NovoExternalObservation): Promise<AmbientReconciliationResult> => {
    // userId on the observation is attribution, not authentication. The
    // independently supplied caller owns the authorization boundary.
    if (caller.userId !== observation.userId) return baseResult('rejected', 'ownership_mismatch')

    try {
      return await store.runAtomically(async (transaction) => {
      const ownsConnection = await transaction.ownsConnection({
        userId: caller.userId,
        provider: observation.provider,
        connectionId: observation.connectionId,
        providerAccountId: observation.providerAccountId,
      })
      if (!ownsConnection) return baseResult('rejected', 'connection_not_owned')

      if (await transaction.isSourcePaused(caller.userId, observation.source)) {
        return baseResult('ignored', 'source_paused')
      }

      const fingerprint = externalObservationFingerprint(observation)
      if (await transaction.findLedgerByFingerprint(caller.userId, fingerprint)) {
        return baseResult('duplicate', 'observation_already_reconciled')
      }

      if (observation.kind !== 'completed') return baseResult('confirmation_required', 'unsupported_kind')
      if (!canonicalCompletionVerification.has(observation.verification)) {
        return baseResult('confirmation_required', 'verification_not_canonical')
      }

      const recommendedActionId = typeof observation.metadata.recommendedActionId === 'string'
        ? observation.metadata.recommendedActionId.trim() || undefined
        : undefined
      const sourceRef = typeof observation.metadata.sourceRef === 'string'
        ? observation.metadata.sourceRef.trim() || undefined
        : undefined
      if (!recommendedActionId && !sourceRef) return baseResult('confirmation_required', 'missing_link')

      const candidates = (await transaction.findLinkedRecommendedActions(
          caller.userId,
          recommendedActionId,
          sourceRef,
        ))
        .filter((action) => action.userId === caller.userId)
        .filter((action) => !recommendedActionId || action.id === recommendedActionId)
        .filter((action) => !sourceRef || action.taskId === sourceRef)
      if (candidates.length === 0) return baseResult('confirmation_required', 'missing_link')
      if (candidates.length !== 1) return baseResult('confirmation_required', 'ambiguous_link')

      const action = candidates[0]
      const resolvedSourceRef = sourceRef ?? action.taskId ?? action.id
      const signalType = completionSignalType(observation.entityType)
      const latest = await transaction.findLatestCompletionSignal(
        caller.userId,
        observation.source,
        resolvedSourceRef,
        signalType,
      )
      if (latest && observation.occurredAt.getTime() <= latest.observedAt.getTime()) {
        return baseResult('stale', 'out_of_order_observation')
      }
      if (action.status === 'completed') return baseResult('duplicate', 'recommendation_already_completed')

      const completedAt = now()
      const idempotencyKey = `ambient:${fingerprint}`
      const activityRunId = `ambient-reconciliation:${fingerprint}`
      const ledger = await transaction.createLedgerSignal({
        userId: caller.userId,
        fingerprint,
        source: observation.source,
        sourceRef: resolvedSourceRef,
        signalType,
        label: `Verified external ${observation.entityType} completion`,
        observedAt: observation.occurredAt,
        reliability: 'deterministic',
      })
      await transaction.completeRecommendedAction({
        id: action.id,
        userId: caller.userId,
        data: {
          status: 'completed',
          statusAt: completedAt,
          completedAt,
          responseAt: completedAt,
          terminalReason: 'verified_external_completion',
          lastActor: observation.actor,
        },
      })
      const outcome = await transaction.createOutcomeEvent({
        userId: caller.userId,
        planId: action.planId,
        recommendedActionId: action.id,
        type: 'completed',
        metadata: {
          actor: observation.actor,
          source: observation.source,
          completion: {
            kind: observation.kind,
            sourceEventId: observation.sourceEventId,
            sourceEntityId: observation.sourceEntityId,
            entityType: observation.entityType,
            occurredAt: observation.occurredAt.toISOString(),
            observedAt: observation.observedAt.toISOString(),
            verification: observation.verification,
            rawContentStored: observation.rawContentStored,
          },
        },
        idempotencyKey,
      })
      await transaction.createActivityRun({
        id: activityRunId,
        userId: caller.userId,
        surface: 'novo_loop',
        phase: 'completed',
        sequence: 1,
        status: 'completed',
        startedAt: completedAt,
        completedAt,
        expiresAt: new Date(completedAt.getTime() + 30 * 60_000),
        resultRef: action.id,
        resultSummary: 'Verified external completion reconciled.',
      })
      await transaction.createActivityEvent({
        id: `ambient-reconciliation-event:${fingerprint}`,
        runId: activityRunId,
        sequence: 1,
        phase: 'completed',
        label: 'External completion reconciled',
        detail: `${observation.source} reported a verified completion.`,
        timestamp: completedAt,
        requiresConfirmation: false,
        recoverable: false,
        terminal: true,
      })

      return {
        disposition: 'completed',
        recommendationId: action.id,
        ledgerSignalId: ledger.id,
        outcomeEventId: outcome.id,
        activityRunId,
        recommendationInvalidated: true,
        learningEligible: false,
      }
      })
    } catch (error) {
      // NovoSignalLedger(userId, fingerprint), OutcomeEvent.idempotencyKey and
      // deterministic activity IDs are the existing uniqueness boundaries.
      // A concurrent transaction losing one of those claims is a replay, not
      // a second completion and not an error to retry into duplicate writes.
      if (isUniqueClaimConflict(error)) return baseResult('duplicate', 'observation_already_reconciled')
      throw error
    }
  }
}
