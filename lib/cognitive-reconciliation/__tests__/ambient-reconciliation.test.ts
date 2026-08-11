import {
  createAmbientReconciliationService,
  type ActivityEventCreate,
  type ActivityRunCreate,
  type ImportedEntityProjection,
  type ImportedEntityRecord,
  type LedgerSignalCreate,
  type NovoExternalObservation,
  type OrderingAssessment,
  type OrderingBasis,
  type OwnedConnectionLookup,
  type ProjectionIdentity,
  type ReconciliationStore,
  type ReconciliationTransaction,
} from '../ambient-reconciliation'

type LedgerRecord = LedgerSignalCreate & { id: string }

class MemoryReconciliationStore implements ReconciliationStore, ReconciliationTransaction {
  readonly connections: OwnedConnectionLookup[] = [{
    userId: 'user-1',
    provider: 'todoist',
    connectionId: 'connection-1',
    providerAccountId: 'todoist-account-1',
  }]
  readonly pausedSources = new Set<string>()
  readonly importedEntities: ImportedEntityRecord[] = [{
    id: 'checklist-1',
    userId: 'user-1',
    provider: 'todoist',
    connectionId: 'connection-1',
    providerAccountId: 'todoist-account-1',
    entityType: 'task',
    sourceEntityId: 'todoist-task-9',
    lifecycleState: 'active',
    lastExternalRevision: 'rev-1',
    lastSyncRunId: null,
  }]
  readonly recommendedActions = [{ id: 'action-1', userId: 'user-1', taskId: 'task-1', status: 'dismissed' }]
  readonly outcomes: Array<Record<string, unknown>> = []
  readonly projections: ImportedEntityProjection[] = []
  readonly ledger: LedgerRecord[] = []
  readonly activityRuns: ActivityRunCreate[] = []
  readonly activityEvents: ActivityEventCreate[] = []
  orderingOverride: OrderingAssessment | null = null

  async runAtomically<T>(work: (transaction: ReconciliationTransaction) => Promise<T>) {
    return work(this)
  }

  async ownsConnection(input: OwnedConnectionLookup) {
    return this.connections.some((connection) => (
      connection.userId === input.userId
      && connection.provider === input.provider
      && connection.connectionId === input.connectionId
      && connection.providerAccountId === input.providerAccountId
    ))
  }

  async isSourcePaused(userId: string, source: string) {
    return this.pausedSources.has(`${userId}:${source}`)
  }

  async findLedgerByFingerprint(userId: string, fingerprint: string) {
    return this.ledger.find((signal) => signal.userId === userId && signal.fingerprint === fingerprint) ?? null
  }

  async findOwnedImportedEntities(identity: ProjectionIdentity) {
    return this.importedEntities.filter((entity) => (
      entity.userId === identity.userId
      && entity.provider === identity.provider
      && entity.connectionId === identity.connectionId
      && entity.providerAccountId === identity.providerAccountId
      && entity.entityType === identity.entityType
      && entity.sourceEntityId === identity.sourceEntityId
    ))
  }

  async assessOrdering(entity: ImportedEntityRecord, observation: NovoExternalObservation, basis: OrderingBasis) {
    if (this.orderingOverride) return this.orderingOverride
    if (basis === 'provider_revision') {
      const current = Number(entity.lastExternalRevision?.replace('rev-', ''))
      const incoming = Number(observation.externalRevision?.replace('rev-', ''))
      const relation = !Number.isFinite(current) || !Number.isFinite(incoming)
        ? 'unknown'
        : incoming > current ? 'newer' : incoming < current ? 'older' : 'tied'
      return { basis, relation } as OrderingAssessment
    }
    return {
      basis,
      relation: entity.lastSyncRunId === observation.syncRunId ? 'tied' : 'newer',
    } as OrderingAssessment
  }

  async createLedgerSignal(input: LedgerSignalCreate) {
    if (this.ledger.some((signal) => signal.userId === input.userId && signal.fingerprint === input.fingerprint)) {
      throw Object.assign(new Error('duplicate ledger fingerprint'), { code: 'P2002' })
    }
    const record = { ...input, id: `ledger-${this.ledger.length + 1}` }
    this.ledger.push(record)
    return record
  }

  async projectImportedLifecycle(input: ImportedEntityProjection) {
    const entity = this.importedEntities.find((candidate) => candidate.id === input.id && candidate.userId === input.userId)
    if (!entity) throw new Error('imported_entity_not_found')
    entity.lifecycleState = input.lifecycleState
    entity.lastExternalRevision = input.externalRevision ?? null
    entity.lastSyncRunId = input.syncRunId ?? null
    this.projections.push(input)
    return entity
  }

  async createActivityRun(input: ActivityRunCreate) {
    this.activityRuns.push(input)
    return input
  }

  async createActivityEvent(input: ActivityEventCreate) {
    this.activityEvents.push(input)
    return input
  }

  // Legacy methods deliberately remain on the fake during RED. They expose
  // any accidental recommendation/outcome mutation by the old service.
  async findLatestCompletionSignal() { return null }
  async findLinkedRecommendedActions() { return [{ id: 'action-1', userId: 'user-1', planId: 'plan-1', taskId: 'task-1', status: this.recommendedActions[0].status }] }
  async completeRecommendedAction(input: { data: { status: string } }) { this.recommendedActions[0].status = input.data.status; return this.recommendedActions[0] }
  async createOutcomeEvent(input: Record<string, unknown>) { this.outcomes.push(input); return { ...input, id: `outcome-${this.outcomes.length}` } }
}

const caller = { userId: 'user-1' }

function completionObservation(overrides: Partial<NovoExternalObservation> = {}): NovoExternalObservation {
  return {
    userId: 'user-1',
    provider: 'todoist',
    connectionId: 'connection-1',
    providerAccountId: 'todoist-account-1',
    source: 'delta_pull',
    sourceEventId: 'event-1',
    deliveryId: 'delivery-1',
    sourceEntityId: 'todoist-task-9',
    entityType: 'task',
    kind: 'completed',
    actor: 'provider_user',
    occurredAt: new Date('2026-08-11T12:00:00.000Z'),
    observedAt: new Date('2026-08-11T12:00:05.000Z'),
    fetchedAt: new Date('2026-08-11T12:00:10.000Z'),
    externalRevision: 'rev-2',
    verification: 'verified_source_state',
    rawContentStored: false,
    metadata: { recommendedActionId: 'action-1', sourceRef: 'task-1' },
    ...overrides,
  }
}

describe('ambient external-observation reconciliation', () => {
  it('projects only the owned imported lifecycle and safe evidence', async () => {
    const store = new MemoryReconciliationStore()
    const reconcile = createAmbientReconciliationService({
      store,
      now: () => new Date('2026-08-11T12:01:00.000Z'),
    })

    const result = await reconcile(caller, completionObservation())

    expect(result).toMatchObject({
      disposition: 'projected',
      importedEntityId: 'checklist-1',
      recommendationInvalidated: false,
      stalePlanDisposition: 'mark_stale',
      learningEligible: false,
    })
    expect(store.importedEntities[0].lifecycleState).toBe('completed')
    expect(store.recommendedActions[0].status).toBe('dismissed')
    expect(store.outcomes).toHaveLength(0)
    expect(store.ledger).toEqual([expect.objectContaining({
      source: 'todoist',
      signalType: 'external_task_completed',
      reliability: 'deterministic',
      observedAt: new Date('2026-08-11T12:00:05.000Z'),
    })])
    expect(store.activityRuns).toEqual([expect.objectContaining({
      userId: 'user-1', surface: 'novo_loop', phase: 'completed', sequence: 1, status: 'completed', resultRef: 'checklist-1',
    })])
    expect(store.activityEvents).toEqual([expect.objectContaining({
      sequence: 1, phase: 'completed', terminal: true, requiresConfirmation: false, recoverable: false,
    })])
  })

  it('deduplicates a replay without duplicate imported, ledger, or activity writes', async () => {
    const store = new MemoryReconciliationStore()
    const reconcile = createAmbientReconciliationService({ store })
    const observation = completionObservation()

    const first = await reconcile(caller, observation)
    const replay = await reconcile(caller, { ...observation, observedAt: new Date('2026-08-11T12:04:00.000Z') })

    expect(first.disposition).toBe('projected')
    expect(replay.disposition).toBe('duplicate')
    expect(store.projections).toHaveLength(1)
    expect(store.ledger).toHaveLength(1)
    expect(store.activityRuns).toHaveLength(1)
    expect(store.activityEvents).toHaveLength(1)
    expect(store.outcomes).toHaveLength(0)
  })

  it('turns a concurrent ledger claim race into one projection and one duplicate', async () => {
    const store = new MemoryReconciliationStore()
    const reconcile = createAmbientReconciliationService({ store })

    const results = await Promise.all([
      reconcile(caller, completionObservation()),
      reconcile(caller, completionObservation()),
    ])

    expect(results.map((result) => result.disposition).sort()).toEqual(['duplicate', 'projected'])
    expect(store.projections).toHaveLength(1)
    expect(store.ledger).toHaveLength(1)
    expect(store.activityRuns).toHaveLength(1)
    expect(store.outcomes).toHaveLength(0)
  })

  it('classifies an older provider revision as stale even when its timestamps are later', async () => {
    const store = new MemoryReconciliationStore()
    const reconcile = createAmbientReconciliationService({ store })
    await reconcile(caller, completionObservation({ sourceEventId: 'event-new', externalRevision: 'rev-3' }))

    const stale = await reconcile(caller, completionObservation({
      sourceEventId: 'event-old',
      deliveryId: 'delivery-old',
      externalRevision: 'rev-2',
      occurredAt: new Date('2026-08-11T13:00:00.000Z'),
      observedAt: new Date('2026-08-11T13:00:05.000Z'),
    }))

    expect(stale).toMatchObject({ disposition: 'stale', reason: 'older_provider_order', stalePlanDisposition: 'unchanged' })
    expect(store.projections).toHaveLength(1)
    expect(store.ledger).toHaveLength(1)
    expect(store.outcomes).toHaveLength(0)
  })

  it('quarantines a completion with no documented revision or serialized sync-run basis', async () => {
    const store = new MemoryReconciliationStore()
    const reconcile = createAmbientReconciliationService({ store })

    const result = await reconcile(caller, completionObservation({ externalRevision: undefined, syncRunId: undefined }))

    expect(result).toMatchObject({ disposition: 'confirmation_required', reason: 'ordering_basis_missing' })
    expect(store.projections).toHaveLength(0)
    expect(store.ledger).toHaveLength(0)
    expect(store.activityRuns).toHaveLength(0)
    expect(store.outcomes).toHaveLength(0)
  })

  it.each(['tied', 'overlap', 'unknown'] as const)(
    'quarantines %s ordering without writes',
    async (relation) => {
      const store = new MemoryReconciliationStore()
      store.orderingOverride = { basis: 'provider_revision', relation }
      const reconcile = createAmbientReconciliationService({ store })

      const result = await reconcile(caller, completionObservation())

      expect(result).toMatchObject({ disposition: 'confirmation_required', reason: `ordering_${relation}` })
      expect(store.projections).toHaveLength(0)
      expect(store.ledger).toHaveLength(0)
      expect(store.activityRuns).toHaveLength(0)
      expect(store.outcomes).toHaveLength(0)
    },
  )

  it('accepts a documented serialized full-sync run without comparing timestamps itself', async () => {
    const store = new MemoryReconciliationStore()
    const reconcile = createAmbientReconciliationService({ store })

    const result = await reconcile(caller, completionObservation({
      source: 'full_pull',
      externalRevision: undefined,
      syncRunId: 'sync-run-2',
    }))

    expect(result.disposition).toBe('projected')
    expect(store.projections).toEqual([expect.objectContaining({ orderingBasis: 'serialized_sync_run', syncRunId: 'sync-run-2' })])
  })

  it('quarantines missing or ambiguous imported entity mappings', async () => {
    const missingStore = new MemoryReconciliationStore()
    missingStore.importedEntities.splice(0)
    const missing = await createAmbientReconciliationService({ store: missingStore })(caller, completionObservation())

    const ambiguousStore = new MemoryReconciliationStore()
    ambiguousStore.importedEntities.push({ ...ambiguousStore.importedEntities[0], id: 'checklist-2' })
    const ambiguous = await createAmbientReconciliationService({ store: ambiguousStore })(caller, completionObservation())

    expect(missing).toMatchObject({ disposition: 'confirmation_required', reason: 'imported_entity_missing' })
    expect(ambiguous).toMatchObject({ disposition: 'confirmation_required', reason: 'ambiguous_imported_entity' })
    expect(missingStore.ledger).toHaveLength(0)
    expect(ambiguousStore.ledger).toHaveLength(0)
    expect(missingStore.outcomes).toHaveLength(0)
    expect(ambiguousStore.outcomes).toHaveLength(0)
  })

  it('rejects forged ownership and an unowned provider connection', async () => {
    const store = new MemoryReconciliationStore()
    const reconcile = createAmbientReconciliationService({ store })

    const forgedUser = await reconcile(caller, completionObservation({ userId: 'user-2' }))
    const foreignConnection = await reconcile(caller, completionObservation({ connectionId: 'connection-2' }))

    expect(forgedUser).toMatchObject({ disposition: 'rejected', reason: 'ownership_mismatch' })
    expect(foreignConnection).toMatchObject({ disposition: 'rejected', reason: 'connection_not_owned' })
    expect(store.projections).toHaveLength(0)
    expect(store.ledger).toHaveLength(0)
    expect(store.outcomes).toHaveLength(0)
  })

  it('ignores a paused provider source without any writes', async () => {
    const store = new MemoryReconciliationStore()
    store.pausedSources.add('user-1:todoist')
    const reconcile = createAmbientReconciliationService({ store })

    const result = await reconcile(caller, completionObservation())

    expect(result).toMatchObject({ disposition: 'ignored', reason: 'source_paused' })
    expect(store.recommendedActions[0].status).toBe('dismissed')
    expect(store.projections).toHaveLength(0)
    expect(store.ledger).toHaveLength(0)
    expect(store.outcomes).toHaveLength(0)
  })

  it.each(['unverified', 'inferred'] as const)(
    'quarantines %s completion evidence',
    async (verification) => {
      const store = new MemoryReconciliationStore()
      const result = await createAmbientReconciliationService({ store })(caller, completionObservation({ verification }))

      expect(result).toMatchObject({ disposition: 'confirmation_required', reason: 'verification_not_canonical' })
      expect(store.projections).toHaveLength(0)
      expect(store.ledger).toHaveLength(0)
      expect(store.outcomes).toHaveLength(0)
    },
  )
})
