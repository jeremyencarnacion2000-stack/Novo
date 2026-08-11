import {
  createAmbientReconciliationService,
  type ActivityEventCreate,
  type ActivityRunCreate,
  type LedgerSignalCreate,
  type NovoExternalObservation,
  type OutcomeEventCreate,
  type OwnedConnectionLookup,
  type ReconciliationStore,
  type ReconciliationTransaction,
  type RecommendedActionRecord,
  type RecommendedActionUpdate,
} from '../ambient-reconciliation'

type LedgerRecord = LedgerSignalCreate & { id: string }
type OutcomeRecord = OutcomeEventCreate & { id: string }

class MemoryReconciliationStore implements ReconciliationStore, ReconciliationTransaction {
  readonly connections: OwnedConnectionLookup[] = [{
    userId: 'user-1',
    provider: 'todoist',
    connectionId: 'connection-1',
    providerAccountId: 'todoist-account-1',
  }]
  readonly pausedSources = new Set<string>()
  readonly actions: RecommendedActionRecord[] = [{
    id: 'action-1',
    userId: 'user-1',
    planId: 'plan-1',
    taskId: 'task-1',
    status: 'started',
  }]
  readonly ledger: LedgerRecord[] = []
  readonly outcomes: OutcomeRecord[] = []
  readonly activityRuns: ActivityRunCreate[] = []
  readonly activityEvents: ActivityEventCreate[] = []

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

  async findLatestCompletionSignal(userId: string, source: string, sourceRef: string, signalType: string) {
    return this.ledger
      .filter((signal) => signal.userId === userId && signal.source === source && signal.sourceRef === sourceRef && signal.signalType === signalType)
      .sort((left, right) => right.observedAt.getTime() - left.observedAt.getTime())[0] ?? null
  }

  async findLinkedRecommendedActions(userId: string, recommendedActionId?: string, sourceRef?: string) {
    return this.actions.filter((action) => (
      action.userId === userId
      && (!recommendedActionId || action.id === recommendedActionId)
      && (!sourceRef || action.taskId === sourceRef)
    ))
  }

  async createLedgerSignal(input: LedgerSignalCreate) {
    if (this.ledger.some((signal) => signal.userId === input.userId && signal.fingerprint === input.fingerprint)) {
      throw Object.assign(new Error('duplicate ledger fingerprint'), { code: 'P2002' })
    }
    const record = { ...input, id: `ledger-${this.ledger.length + 1}` }
    this.ledger.push(record)
    return record
  }

  async completeRecommendedAction(input: RecommendedActionUpdate) {
    const action = this.actions.find((candidate) => candidate.id === input.id && candidate.userId === input.userId)
    if (!action) throw new Error('recommended_action_not_found')
    Object.assign(action, input.data)
    return action
  }

  async createOutcomeEvent(input: OutcomeEventCreate) {
    const record = { ...input, id: `outcome-${this.outcomes.length + 1}` }
    this.outcomes.push(record)
    return record
  }

  async createActivityRun(input: ActivityRunCreate) {
    this.activityRuns.push(input)
    return input
  }

  async createActivityEvent(input: ActivityEventCreate) {
    this.activityEvents.push(input)
    return input
  }
}

const caller = { userId: 'user-1' }

function completionObservation(overrides: Partial<NovoExternalObservation> = {}): NovoExternalObservation {
  return {
    userId: 'user-1',
    provider: 'todoist',
    connectionId: 'connection-1',
    providerAccountId: 'todoist-account-1',
    source: 'todoist',
    sourceEventId: 'event-1',
    sourceEntityId: 'todoist-task-9',
    entityType: 'task',
    kind: 'completed',
    actor: 'provider_user',
    occurredAt: new Date('2026-08-11T12:00:00.000Z'),
    observedAt: new Date('2026-08-11T12:00:05.000Z'),
    verification: 'verified_source_state',
    rawContentStored: false,
    metadata: { recommendedActionId: 'action-1', sourceRef: 'task-1' },
    ...overrides,
  }
}

describe('ambient external-observation reconciliation', () => {
  it('deduplicates a replayed provider event by its stable fingerprint', async () => {
    const store = new MemoryReconciliationStore()
    const reconcile = createAmbientReconciliationService({ store })
    const observation = completionObservation()

    const first = await reconcile(caller, observation)
    const replay = await reconcile(caller, { ...observation, observedAt: new Date('2026-08-11T12:02:00.000Z') })

    expect(first.disposition).toBe('completed')
    expect(replay.disposition).toBe('duplicate')
    expect(store.ledger).toHaveLength(1)
    expect(store.outcomes).toHaveLength(1)
    expect(store.activityRuns).toHaveLength(1)
    expect(store.activityEvents).toHaveLength(1)
  })

  it('turns a concurrent unique-claim race into one completion and one duplicate', async () => {
    const store = new MemoryReconciliationStore()
    const reconcile = createAmbientReconciliationService({ store })

    const results = await Promise.all([
      reconcile(caller, completionObservation()),
      reconcile(caller, completionObservation()),
    ])

    expect(results.map((result) => result.disposition).sort()).toEqual(['completed', 'duplicate'])
    expect(store.ledger).toHaveLength(1)
    expect(store.outcomes).toHaveLength(1)
    expect(store.activityRuns).toHaveLength(1)
    expect(store.activityEvents).toHaveLength(1)
  })

  it('leaves state unchanged when an older completion arrives out of order', async () => {
    const store = new MemoryReconciliationStore()
    const reconcile = createAmbientReconciliationService({ store })
    await reconcile(caller, completionObservation({ sourceEventId: 'event-new' }))

    const stale = await reconcile(caller, completionObservation({
      sourceEventId: 'event-old',
      occurredAt: new Date('2026-08-11T11:59:59.000Z'),
      observedAt: new Date('2026-08-11T12:03:00.000Z'),
    }))

    expect(stale.disposition).toBe('stale')
    expect(store.ledger).toHaveLength(1)
    expect(store.outcomes).toHaveLength(1)
  })

  it('requires confirmation when a source reference resolves ambiguously', async () => {
    const store = new MemoryReconciliationStore()
    store.actions.push({ id: 'action-2', userId: 'user-1', planId: 'plan-2', taskId: 'task-1', status: 'accepted' })
    const reconcile = createAmbientReconciliationService({ store })

    const result = await reconcile(caller, completionObservation({
      metadata: { sourceRef: 'task-1' },
    }))

    expect(result).toMatchObject({ disposition: 'confirmation_required', reason: 'ambiguous_link' })
    expect(store.actions.map((action) => action.status)).toEqual(['started', 'accepted'])
    expect(store.ledger).toHaveLength(0)
    expect(store.outcomes).toHaveLength(0)
  })

  it('requires confirmation when neither an action nor a source reference is linked', async () => {
    const store = new MemoryReconciliationStore()
    const reconcile = createAmbientReconciliationService({ store })

    const result = await reconcile(caller, completionObservation({ metadata: {} }))

    expect(result).toMatchObject({ disposition: 'confirmation_required', reason: 'missing_link' })
    expect(store.actions[0].status).toBe('started')
    expect(store.ledger).toHaveLength(0)
    expect(store.outcomes).toHaveLength(0)
  })

  it('requires confirmation when an action ID and source reference do not belong to the same link', async () => {
    const store = new MemoryReconciliationStore()
    const reconcile = createAmbientReconciliationService({ store })

    const result = await reconcile(caller, completionObservation({
      metadata: { recommendedActionId: 'action-1', sourceRef: 'another-user-task' },
    }))

    expect(result).toMatchObject({ disposition: 'confirmation_required', reason: 'missing_link' })
    expect(store.actions[0].status).toBe('started')
    expect(store.ledger).toHaveLength(0)
    expect(store.outcomes).toHaveLength(0)
  })

  it('rejects an observation whose user or provider connection is not owned by the caller', async () => {
    const store = new MemoryReconciliationStore()
    const reconcile = createAmbientReconciliationService({ store })

    const forgedUser = await reconcile(caller, completionObservation({ userId: 'user-2' }))
    const foreignConnection = await reconcile(caller, completionObservation({ connectionId: 'connection-2' }))

    expect(forgedUser).toMatchObject({ disposition: 'rejected', reason: 'ownership_mismatch' })
    expect(foreignConnection).toMatchObject({ disposition: 'rejected', reason: 'connection_not_owned' })
    expect(store.ledger).toHaveLength(0)
    expect(store.outcomes).toHaveLength(0)
  })

  it('does not trust a linked-action resolver that returns another user\'s action', async () => {
    const store = new MemoryReconciliationStore()
    store.findLinkedRecommendedActions = async () => [{
      id: 'foreign-action',
      userId: 'user-2',
      planId: 'foreign-plan',
      taskId: 'task-1',
      status: 'started',
    }]
    const reconcile = createAmbientReconciliationService({ store })

    const result = await reconcile(caller, completionObservation())

    expect(result).toMatchObject({ disposition: 'confirmation_required', reason: 'missing_link' })
    expect(store.ledger).toHaveLength(0)
    expect(store.outcomes).toHaveLength(0)
  })

  it('ignores a user-paused source without touching recommendations or outcomes', async () => {
    const store = new MemoryReconciliationStore()
    store.pausedSources.add('user-1:todoist')
    const reconcile = createAmbientReconciliationService({ store })

    const result = await reconcile(caller, completionObservation())

    expect(result).toMatchObject({ disposition: 'ignored', reason: 'source_paused' })
    expect(store.actions[0].status).toBe('started')
    expect(store.ledger).toHaveLength(0)
    expect(store.outcomes).toHaveLength(0)
  })

  it.each(['unverified', 'inferred'] as const)(
    'requires confirmation for %s completion evidence',
    async (verification) => {
      const store = new MemoryReconciliationStore()
      const reconcile = createAmbientReconciliationService({ store })

      const result = await reconcile(caller, completionObservation({ verification }))

      expect(result).toMatchObject({ disposition: 'confirmation_required', reason: 'verification_not_canonical' })
      expect(store.ledger).toHaveLength(0)
      expect(store.outcomes).toHaveLength(0)
    },
  )

  it.each(['verified_source_state', 'signed_webhook', 'deterministic_match'] as const)(
    'accepts %s as canonical completion evidence',
    async (verification) => {
      const store = new MemoryReconciliationStore()
      const reconcile = createAmbientReconciliationService({ store })

      const result = await reconcile(caller, completionObservation({ verification }))

      expect(result.disposition).toBe('completed')
      expect(store.ledger).toHaveLength(1)
      expect(store.outcomes).toHaveLength(1)
    },
  )

  it('records one attributable completion while invalidating, but not learning from, the recommendation', async () => {
    const store = new MemoryReconciliationStore()
    const reconcile = createAmbientReconciliationService({
      store,
      now: () => new Date('2026-08-11T12:01:00.000Z'),
    })

    const result = await reconcile(caller, completionObservation({ verification: 'signed_webhook' }))

    expect(result).toMatchObject({
      disposition: 'completed',
      recommendationId: 'action-1',
      recommendationInvalidated: true,
      learningEligible: false,
    })
    expect(store.actions[0]).toMatchObject({
      status: 'completed',
      completedAt: new Date('2026-08-11T12:01:00.000Z'),
      lastActor: 'provider_user',
    })
    expect(store.ledger).toEqual([
      expect.objectContaining({
        source: 'todoist',
        sourceRef: 'task-1',
        signalType: 'external_task_completed',
        reliability: 'deterministic',
        observedAt: new Date('2026-08-11T12:00:00.000Z'),
      }),
    ])
    expect(store.outcomes).toEqual([
      expect.objectContaining({
        userId: 'user-1',
        planId: 'plan-1',
        recommendedActionId: 'action-1',
        type: 'completed',
        metadata: {
          actor: 'provider_user',
          source: 'todoist',
          completion: {
            kind: 'completed',
            sourceEventId: 'event-1',
            sourceEntityId: 'todoist-task-9',
            entityType: 'task',
            occurredAt: '2026-08-11T12:00:00.000Z',
            observedAt: '2026-08-11T12:00:05.000Z',
            verification: 'signed_webhook',
            rawContentStored: false,
          },
        },
      }),
    ])
    expect(store.activityRuns).toEqual([
      expect.objectContaining({
        userId: 'user-1',
        surface: 'novo_loop',
        phase: 'completed',
        sequence: 1,
        status: 'completed',
        resultRef: 'action-1',
      }),
    ])
    expect(store.activityEvents).toEqual([
      expect.objectContaining({
        sequence: 1,
        phase: 'completed',
        terminal: true,
        requiresConfirmation: false,
        recoverable: false,
      }),
    ])
  })
})
