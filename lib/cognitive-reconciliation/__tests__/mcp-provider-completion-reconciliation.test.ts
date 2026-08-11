import {
  createMcpProviderCompletionAdapter,
  type McpProviderCompletion,
} from '../mcp-provider-completion-reconciliation'
import type {
  ActivityEventCreate,
  ActivityRunCreate,
  ImportedEntityProjection,
  ImportedEntityRecord,
  LedgerSignalCreate,
  NovoExternalObservation,
  OrderingBasis,
  OwnedConnectionLookup,
  ProjectionIdentity,
  ReconciliationStore,
  ReconciliationTransaction,
} from '../ambient-reconciliation'

class MemoryStore implements ReconciliationStore, ReconciliationTransaction {
  connections: OwnedConnectionLookup[] = [{
    userId: 'user-1', provider: 'todoist', connectionId: 'connection-1', providerAccountId: 'account-1',
  }]
  imported: ImportedEntityRecord[] = [{
    id: 'checklist-1', userId: 'user-1', provider: 'todoist', connectionId: 'connection-1', providerAccountId: 'account-1',
    entityType: 'task', sourceEntityId: 'todoist-task-1', lifecycleState: 'active', lastExternalRevision: 'rev-1', lastSyncRunId: null,
  }]
  ledger: Array<LedgerSignalCreate & { id: string }> = []
  projections: ImportedEntityProjection[] = []
  runs: ActivityRunCreate[] = []
  events: ActivityEventCreate[] = []
  readonly recommendedActions = [{ id: 'action-1', status: 'accepted' }]
  readonly outcomeEvents: unknown[] = []
  seenObservations: NovoExternalObservation[] = []

  async runAtomically<T>(work: (transaction: ReconciliationTransaction) => Promise<T>) { return work(this) }
  async ownsConnection(input: OwnedConnectionLookup) {
    return this.connections.some((connection) => JSON.stringify(connection) === JSON.stringify(input))
  }
  async isSourcePaused() { return false }
  async findLedgerByFingerprint(userId: string, fingerprint: string) {
    return this.ledger.find((record) => record.userId === userId && record.fingerprint === fingerprint) ?? null
  }
  async findOwnedImportedEntities(identity: ProjectionIdentity) {
    return this.imported.filter((entity) => (
      entity.userId === identity.userId && entity.provider === identity.provider && entity.connectionId === identity.connectionId
      && entity.providerAccountId === identity.providerAccountId && entity.entityType === identity.entityType
      && entity.sourceEntityId === identity.sourceEntityId
    ))
  }
  async assessOrdering(entity: ImportedEntityRecord, observation: NovoExternalObservation, basis: OrderingBasis) {
    this.seenObservations.push(observation)
    const incoming = Number(observation.externalRevision?.replace('rev-', ''))
    const current = Number(entity.lastExternalRevision?.replace('rev-', ''))
    return { basis, relation: incoming > current ? 'newer' as const : incoming === current ? 'tied' as const : 'older' as const }
  }
  async createLedgerSignal(input: LedgerSignalCreate) {
    if (this.ledger.some((record) => record.userId === input.userId && record.fingerprint === input.fingerprint)) {
      throw Object.assign(new Error('duplicate'), { code: 'P2002' })
    }
    const result = { ...input, id: `ledger-${this.ledger.length + 1}` }
    this.ledger.push(result)
    return result
  }
  async projectImportedLifecycle(input: ImportedEntityProjection) {
    const entity = this.imported.find((item) => item.id === input.id)
    if (!entity) throw new Error('missing_imported_entity')
    entity.lifecycleState = input.lifecycleState
    entity.lastExternalRevision = input.externalRevision
    this.projections.push(input)
    return entity
  }
  async createActivityRun(input: ActivityRunCreate) { this.runs.push(input); return input }
  async createActivityEvent(input: ActivityEventCreate) { this.events.push(input); return input }
}

function completion(overrides: Partial<McpProviderCompletion> = {}): McpProviderCompletion {
  return {
    provider: 'todoist', connectionId: 'connection-1', providerAccountId: 'account-1', entityType: 'task', sourceEntityId: 'todoist-task-1',
    sourceEventId: 'provider-event-1', externalRevision: 'rev-2',
    verification: 'verified_source_state',
    occurredAt: new Date('2026-08-11T12:00:00.000Z'), observedAt: new Date('2026-08-11T12:00:01.000Z'), fetchedAt: new Date('2026-08-11T12:00:02.000Z'),
    importedEntityRelation: {
      importedEntityId: 'checklist-1', verified: true, userId: 'user-1', provider: 'todoist', connectionId: 'connection-1',
      providerAccountId: 'account-1', entityType: 'task', sourceEntityId: 'todoist-task-1',
    },
    ...overrides,
  }
}

describe('MCP provider completion ambient adapter', () => {
  it('routes a verified relation through the ambient core with agent/MCP attribution', async () => {
    const store = new MemoryStore()
    const reconcile = createMcpProviderCompletionAdapter({ store, now: () => new Date('2026-08-11T12:01:00.000Z') })

    const result = await reconcile({ userId: 'user-1' }, completion())

    expect(result).toMatchObject({ disposition: 'projected', importedEntityId: 'checklist-1', stalePlanDisposition: 'mark_stale' })
    expect(store.seenObservations).toEqual([expect.objectContaining({ source: 'mcp', actor: 'agent', rawContentStored: false })])
    expect(store.projections).toHaveLength(1)
    expect(store.ledger).toHaveLength(1)
    expect(store.runs).toHaveLength(1)
    expect(store.events).toHaveLength(1)
  })

  it('deduplicates an MCP replay in the same core ledger', async () => {
    const store = new MemoryStore()
    const reconcile = createMcpProviderCompletionAdapter({ store })

    expect((await reconcile({ userId: 'user-1' }, completion())).disposition).toBe('projected')
    expect((await reconcile({ userId: 'user-1' }, completion({ observedAt: new Date('2026-08-11T12:05:00.000Z') }))).disposition).toBe('duplicate')
    expect(store.projections).toHaveLength(1)
    expect(store.ledger).toHaveLength(1)
    expect(store.runs).toHaveLength(1)
  })

  it.each([
    ['missing', completion({ importedEntityRelation: undefined })],
    ['ambiguous', completion({ importedEntityRelation: { ...completion().importedEntityRelation!, sourceEntityId: 'another-provider-task' } })],
  ])('quarantines a %s verified-relation mapping without writes', async (_kind, input) => {
    const store = new MemoryStore()
    const result = await createMcpProviderCompletionAdapter({ store })({ userId: 'user-1' }, input)

    expect(result.disposition).toBe('confirmation_required')
    expect(store.projections).toHaveLength(0)
    expect(store.ledger).toHaveLength(0)
    expect(store.runs).toHaveLength(0)
  })

  it('does not let a relation for another owner enter the owned connection lookup', async () => {
    const store = new MemoryStore()
    const input = completion({ importedEntityRelation: { ...completion().importedEntityRelation!, userId: 'user-2' } })
    const result = await createMcpProviderCompletionAdapter({ store })({ userId: 'user-1' }, input)

    expect(result).toMatchObject({ disposition: 'confirmation_required', reason: 'imported_entity_relation_unverified' })
    expect(store.ledger).toHaveLength(0)
    expect(store.seenObservations).toHaveLength(0)
  })

  it('rejects incomplete provider identity before it enters the reconciliation store', async () => {
    const store = new MemoryStore()
    const result = await createMcpProviderCompletionAdapter({ store })({ userId: 'user-1' }, completion({ providerAccountId: undefined }))

    expect(result).toMatchObject({ disposition: 'confirmation_required', reason: 'provider_identity_incomplete' })
    expect(store.ledger).toHaveLength(0)
    expect(store.seenObservations).toHaveLength(0)
  })

  it.each([
    ['omitted', undefined, 'verification_evidence_missing'],
    ['unverified', 'unverified', 'verification_not_canonical'],
    ['inferred', 'inferred', 'verification_not_canonical'],
  ] as const)('quarantines %s provider verification without writes', async (_kind, verification, reason) => {
    const store = new MemoryStore()
    const result = await createMcpProviderCompletionAdapter({ store })({ userId: 'user-1' }, completion({ verification }))

    expect(result).toMatchObject({ disposition: 'confirmation_required', reason })
    expect(store.projections).toHaveLength(0)
    expect(store.ledger).toHaveLength(0)
    expect(store.runs).toHaveLength(0)
    expect(store.seenObservations).toHaveLength(0)
  })

  it('keeps recommendation outcomes exclusively on their explicit MCP tool path', async () => {
    const store = new MemoryStore()
    await createMcpProviderCompletionAdapter({ store })({ userId: 'user-1' }, completion())

    expect(store.recommendedActions).toEqual([{ id: 'action-1', status: 'accepted' }])
    expect(store.outcomeEvents).toHaveLength(0)
  })
})
