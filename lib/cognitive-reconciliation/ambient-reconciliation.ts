import { createHash } from 'node:crypto'

export type CanonicalObservationVerification =
  | 'verified_source_state'
  | 'signed_webhook'
  | 'deterministic_match'
  | 'unverified'
  | 'inferred'

export type ExternalObservationSource = 'webhook' | 'delta_pull' | 'full_pull' | 'manual_sync'

export type NovoExternalObservation = {
  userId: string
  provider: string
  connectionId: string
  providerAccountId: string
  source: ExternalObservationSource
  sourceEventId: string
  deliveryId?: string
  sourceEntityId: string
  entityType: string
  kind: string
  actor: string
  occurredAt: Date
  observedAt: Date
  fetchedAt: Date
  externalRevision?: string
  syncRunId?: string
  verification: CanonicalObservationVerification
  rawContentStored: boolean
  metadata: Readonly<Record<string, unknown>>
}

export type ReconciliationCaller = { userId: string }

export type OwnedConnectionLookup = {
  userId: string
  provider: string
  connectionId: string
  providerAccountId: string
}

export type ProjectionIdentity = OwnedConnectionLookup & {
  entityType: string
  sourceEntityId: string
}

export type ImportedEntityRecord = ProjectionIdentity & {
  id: string
  lifecycleState: string
  lastExternalRevision: string | null
  lastSyncRunId: string | null
}

export type OrderingBasis = 'provider_revision' | 'serialized_sync_run'
export type OrderingRelation = 'newer' | 'older' | 'tied' | 'overlap' | 'unknown'
export type OrderingAssessment = { basis: OrderingBasis; relation: OrderingRelation }

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

export type ImportedEntityProjection = {
  id: string
  userId: string
  lifecycleState: 'completed'
  orderingBasis: OrderingBasis
  externalRevision: string | null
  syncRunId: string | null
  fetchedAt: Date
  observedAt: Date
  actor: string
  sourceEventId: string
  deliveryId: string | null
}

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
  findOwnedImportedEntities(identity: ProjectionIdentity): Promise<ImportedEntityRecord[]>
  assessOrdering(entity: ImportedEntityRecord, observation: NovoExternalObservation, basis: OrderingBasis): Promise<OrderingAssessment>
  createLedgerSignal(input: LedgerSignalCreate): Promise<LedgerSignalRecord>
  projectImportedLifecycle(input: ImportedEntityProjection): Promise<ImportedEntityRecord>
  createActivityRun(input: ActivityRunCreate): Promise<ActivityRunCreate>
  createActivityEvent(input: ActivityEventCreate): Promise<ActivityEventCreate>
}

export type ReconciliationStore = {
  runAtomically<T>(work: (transaction: ReconciliationTransaction) => Promise<T>): Promise<T>
}

export type StalePlanDisposition = 'unchanged' | 'mark_stale'

export type AmbientReconciliationResult = {
  disposition: 'projected' | 'duplicate' | 'stale' | 'confirmation_required' | 'ignored' | 'rejected'
  reason?: string
  importedEntityId?: string
  ledgerSignalId?: string
  activityRunId?: string
  recommendationInvalidated: false
  stalePlanDisposition: StalePlanDisposition
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
    stalePlanDisposition: 'unchanged',
    learningEligible: false,
  }
}

/** Delivery identity is intentionally distinct from ordering evidence. */
export function externalObservationFingerprint(observation: NovoExternalObservation) {
  return createHash('sha256').update(JSON.stringify([
    observation.userId,
    observation.provider,
    observation.connectionId,
    observation.providerAccountId,
    observation.entityType,
    observation.sourceEntityId,
    observation.source,
    observation.sourceEventId,
    observation.deliveryId ?? null,
    observation.externalRevision ?? null,
    observation.syncRunId ?? null,
    observation.kind,
  ])).digest('hex')
}

function completionSignalType(entityType: string) {
  const safeEntityType = entityType.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_') || 'entity'
  return `external_${safeEntityType}_completed`
}

function projectionSourceRef(identity: ProjectionIdentity) {
  return [identity.provider, identity.connectionId, identity.providerAccountId, identity.entityType, identity.sourceEntityId].join(':')
}

function orderingBasis(observation: NovoExternalObservation): OrderingBasis | null {
  if (observation.externalRevision?.trim()) return 'provider_revision'
  const serializedSnapshot = (observation.source === 'full_pull' || observation.source === 'manual_sync')
    && Boolean(observation.syncRunId?.trim())
    && Number.isFinite(observation.fetchedAt.getTime())
  return serializedSnapshot ? 'serialized_sync_run' : null
}

function isUniqueClaimConflict(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

export function createAmbientReconciliationService({ store, now = () => new Date() }: AmbientReconciliationDependencies) {
  return async (caller: ReconciliationCaller, observation: NovoExternalObservation): Promise<AmbientReconciliationResult> => {
    // Observation ownership is attribution only; authorization comes from the
    // independently authenticated caller and the owned connection lookup.
    if (caller.userId !== observation.userId) return baseResult('rejected', 'ownership_mismatch')

    try {
      return await store.runAtomically(async (transaction) => {
        const connection = {
          userId: caller.userId,
          provider: observation.provider,
          connectionId: observation.connectionId,
          providerAccountId: observation.providerAccountId,
        }
        if (!await transaction.ownsConnection(connection)) return baseResult('rejected', 'connection_not_owned')

        const providerPaused = await transaction.isSourcePaused(caller.userId, observation.provider)
        const transportPaused = await transaction.isSourcePaused(caller.userId, observation.source)
        if (providerPaused || transportPaused) return baseResult('ignored', 'source_paused')

        const fingerprint = externalObservationFingerprint(observation)
        if (await transaction.findLedgerByFingerprint(caller.userId, fingerprint)) {
          return baseResult('duplicate', 'observation_already_reconciled')
        }

        if (observation.kind !== 'completed') return baseResult('confirmation_required', 'unsupported_kind')
        if (!canonicalCompletionVerification.has(observation.verification)) {
          return baseResult('confirmation_required', 'verification_not_canonical')
        }

        const basis = orderingBasis(observation)
        if (!basis) return baseResult('confirmation_required', 'ordering_basis_missing')

        const identity: ProjectionIdentity = {
          ...connection,
          entityType: observation.entityType,
          sourceEntityId: observation.sourceEntityId,
        }
        const candidates = (await transaction.findOwnedImportedEntities(identity))
          .filter((entity) => entity.userId === identity.userId)
          .filter((entity) => entity.provider === identity.provider)
          .filter((entity) => entity.connectionId === identity.connectionId)
          .filter((entity) => entity.providerAccountId === identity.providerAccountId)
          .filter((entity) => entity.entityType === identity.entityType)
          .filter((entity) => entity.sourceEntityId === identity.sourceEntityId)
        if (candidates.length === 0) return baseResult('confirmation_required', 'imported_entity_missing')
        if (candidates.length !== 1) return baseResult('confirmation_required', 'ambiguous_imported_entity')

        const entity = candidates[0]
        const order = await transaction.assessOrdering(entity, observation, basis)
        if (order.basis !== basis) return baseResult('confirmation_required', 'ordering_unknown')
        if (order.relation === 'older') return baseResult('stale', 'older_provider_order')
        if (order.relation !== 'newer') return baseResult('confirmation_required', `ordering_${order.relation}`)
        if (entity.lifecycleState === 'completed') return baseResult('duplicate', 'imported_entity_already_completed')

        const completedAt = now()
        const activityRunId = `ambient-reconciliation:${fingerprint}`

        // The ledger claim is inside the same required transaction as the
        // imported projection and activity writes. It is not an OutcomeEvent
        // and does not authorize any RecommendedAction or Task transition.
        const ledger = await transaction.createLedgerSignal({
          userId: caller.userId,
          fingerprint,
          source: observation.provider,
          sourceRef: projectionSourceRef(identity),
          signalType: completionSignalType(observation.entityType),
          label: `Verified imported ${observation.entityType} completion`,
          observedAt: observation.observedAt,
          reliability: 'deterministic',
        })
        await transaction.projectImportedLifecycle({
          id: entity.id,
          userId: caller.userId,
          lifecycleState: 'completed',
          orderingBasis: basis,
          externalRevision: observation.externalRevision ?? null,
          syncRunId: observation.syncRunId ?? null,
          fetchedAt: observation.fetchedAt,
          observedAt: observation.observedAt,
          actor: observation.actor,
          sourceEventId: observation.sourceEventId,
          deliveryId: observation.deliveryId ?? null,
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
          resultRef: entity.id,
          resultSummary: 'Verified imported lifecycle reconciled; planning context is stale.',
        })
        await transaction.createActivityEvent({
          id: `ambient-reconciliation-event:${fingerprint}`,
          runId: activityRunId,
          sequence: 1,
          phase: 'completed',
          label: 'Imported completion reconciled',
          detail: `${observation.provider} reported a verified imported completion.`,
          timestamp: completedAt,
          requiresConfirmation: false,
          recoverable: false,
          terminal: true,
        })

        return {
          disposition: 'projected',
          importedEntityId: entity.id,
          ledgerSignalId: ledger.id,
          activityRunId,
          recommendationInvalidated: false,
          stalePlanDisposition: 'mark_stale',
          learningEligible: false,
        }
      })
    } catch (error) {
      if (isUniqueClaimConflict(error)) return baseResult('duplicate', 'observation_already_reconciled')
      throw error
    }
  }
}
