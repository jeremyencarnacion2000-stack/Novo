import {
  createTodoistHumanReconciliationService,
  type TodoistCompletionEvent,
  type TodoistHumanPullResult,
  type TodoistOwnedConnection,
  type TodoistReconciliationStore,
} from '../todoist-human-reconciliation'
import type {
  ActivityEventCreate,
  ActivityRunCreate,
  ImportedEntityProjection,
  ImportedEntityRecord,
  LedgerSignalCreate,
  NovoExternalObservation,
  OrderingBasis,
  ProjectionIdentity,
  ReconciliationStore,
  ReconciliationTransaction,
} from '../ambient-reconciliation'

type Item = ImportedEntityRecord & { completed: boolean; text: string; projectId: string }

class MemoryStore implements TodoistReconciliationStore, ReconciliationTransaction {
  connection: TodoistOwnedConnection | null = {
    userId: 'user-1',
    connectionId: 'integration-1',
    providerAccountId: 'integration-1',
    accessToken: 'server-token',
    selectedProjectIds: ['project-1'],
    scopeKey: 'project-1',
    cursor: null,
    lastSuccessfulRunId: null,
  }
  inFlightRunId: string | null = null
  items: Item[] = []
  ledger: Array<LedgerSignalCreate & { id: string }> = []
  activityRuns: ActivityRunCreate[] = []
  activityEvents: ActivityEventCreate[] = []
  outcomes: unknown[] = []
  behavioralSignals: unknown[] = []
  recommendedActions = [{ id: 'action-1', status: 'proposed' }]
  tasks = [{ id: 'task-1', status: 'todo' }]
  paused = new Set<string>()
  failBootstrap = false
  failSourceId: string | null = null
  failFinish = false
  private activeRunId: string | null = null

  async loadOwnedConnection(userId: string) {
    return this.connection?.userId === userId ? { ...this.connection } : null
  }

  async claimRun(connection: TodoistOwnedConnection, runId: string) {
    if (!this.connection || this.connection.connectionId !== connection.connectionId || this.inFlightRunId) return false
    this.inFlightRunId = runId
    this.activeRunId = runId
    return true
  }

  async bootstrap(input: Parameters<TodoistReconciliationStore['bootstrap']>[0]) {
    if (this.failBootstrap) throw new Error('bootstrap_failed')
    if (this.inFlightRunId !== input.runId) throw new Error('run_not_owned')
    let created = 0
    for (const task of input.tasks) {
      const matches = this.items.filter((item) => item.userId === input.connection.userId && item.sourceEntityId === task.id)
      if (matches.length > 1) throw new Error('ambiguous_imported_entity')
      if (matches.length === 0) {
        this.items.push({
          id: `checklist-${this.items.length + 1}`,
          userId: input.connection.userId,
          provider: 'todoist',
          connectionId: input.connection.connectionId,
          providerAccountId: input.connection.providerAccountId,
          entityType: 'task',
          sourceEntityId: task.id,
          lifecycleState: 'active',
          lastExternalRevision: null,
          lastSyncRunId: null,
          completed: false,
          text: task.text,
          projectId: task.projectId,
        })
        created += 1
      }
    }
    this.connection = {
      ...input.connection,
      cursor: input.cursorAfter,
      lastSuccessfulRunId: input.runId,
    }
    this.inFlightRunId = null
    return { created, existing: input.tasks.length - created }
  }

  ambientStore(_connection: TodoistOwnedConnection, runId: string): ReconciliationStore {
    this.activeRunId = runId
    return this
  }

  async finishRun(input: Parameters<TodoistReconciliationStore['finishRun']>[0]) {
    if (this.failFinish) throw new Error('finish_failed')
    if (!this.connection || this.inFlightRunId !== input.runId) throw new Error('run_not_owned')
    this.connection = { ...this.connection, cursor: input.cursorAfter, lastSuccessfulRunId: input.runId }
    this.inFlightRunId = null
  }

  async abandonRun(_connection: TodoistOwnedConnection, runId: string) {
    if (this.inFlightRunId === runId) this.inFlightRunId = null
  }

  async runAtomically<T>(work: (transaction: ReconciliationTransaction) => Promise<T>) {
    const snapshot = {
      items: this.items.map((item) => ({ ...item })),
      ledger: [...this.ledger],
      activityRuns: [...this.activityRuns],
      activityEvents: [...this.activityEvents],
    }
    try {
      return await work(this)
    } catch (error) {
      this.items = snapshot.items
      this.ledger = snapshot.ledger
      this.activityRuns = snapshot.activityRuns
      this.activityEvents = snapshot.activityEvents
      throw error
    }
  }

  async ownsConnection(input: { userId: string; provider: string; connectionId: string; providerAccountId: string }) {
    return Boolean(this.connection
      && this.inFlightRunId === this.activeRunId
      && input.userId === this.connection.userId
      && input.provider === 'todoist'
      && input.connectionId === this.connection.connectionId
      && input.providerAccountId === this.connection.providerAccountId)
  }

  async isSourcePaused(userId: string, source: string) {
    return this.paused.has(`${userId}:${source}`)
  }

  async findLedgerByFingerprint(userId: string, fingerprint: string) {
    return this.ledger.find((entry) => entry.userId === userId && entry.fingerprint === fingerprint) ?? null
  }

  async findOwnedImportedEntities(identity: ProjectionIdentity) {
    if (this.failSourceId === identity.sourceEntityId) throw new Error('projection_failed')
    return this.items.filter((item) => (
      item.userId === identity.userId
      && item.provider === identity.provider
      && item.connectionId === identity.connectionId
      && item.providerAccountId === identity.providerAccountId
      && item.entityType === identity.entityType
      && item.sourceEntityId === identity.sourceEntityId
    ))
  }

  async assessOrdering(_entity: ImportedEntityRecord, observation: NovoExternalObservation, basis: OrderingBasis) {
    return { basis, relation: observation.syncRunId === this.activeRunId ? 'newer' as const : 'unknown' as const }
  }

  async createLedgerSignal(input: LedgerSignalCreate) {
    if (this.ledger.some((entry) => entry.userId === input.userId && entry.fingerprint === input.fingerprint)) {
      throw Object.assign(new Error('duplicate'), { code: 'P2002' })
    }
    const record = { ...input, id: `ledger-${this.ledger.length + 1}` }
    this.ledger.push(record)
    return record
  }

  async projectImportedLifecycle(input: ImportedEntityProjection) {
    const item = this.items.find((candidate) => candidate.id === input.id && candidate.userId === input.userId)
    if (!item) throw new Error('missing')
    item.completed = true
    item.lifecycleState = 'completed'
    item.lastSyncRunId = input.syncRunId
    return item
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

function activeTask(id = 'todoist-task-1') {
  return { id, projectId: 'project-1', text: 'Write the brief', priority: 'high' as const, dueDate: null }
}

function completion(id = 'todoist-task-1', eventId = 'event-1'): TodoistCompletionEvent {
  return {
    eventId,
    taskId: id,
    projectId: 'project-1',
    occurredAt: new Date('2026-08-11T12:00:00.000Z'),
  }
}

function pull(overrides: Partial<TodoistHumanPullResult> = {}): TodoistHumanPullResult {
  return {
    fetchedAt: new Date('2026-08-11T12:01:00.000Z'),
    cursorAfter: '2026-08-11T12:01:00.000Z',
    activeTasks: [activeTask()],
    completions: [],
    ...overrides,
  }
}

function seededStore() {
  const store = new MemoryStore()
  store.connection = {
    ...store.connection!,
    cursor: '2026-08-11T11:00:00.000Z',
    lastSuccessfulRunId: 'bootstrap-run',
  }
  store.items.push({
    id: 'checklist-1',
    userId: 'user-1',
    provider: 'todoist',
    connectionId: 'integration-1',
    providerAccountId: 'integration-1',
    entityType: 'task',
    sourceEntityId: 'todoist-task-1',
    lifecycleState: 'active',
    lastExternalRevision: null,
    lastSyncRunId: 'bootstrap-run',
    completed: false,
    text: 'Write the brief',
    projectId: 'project-1',
  })
  return store
}

function service(store: MemoryStore, pulls: TodoistHumanPullResult[]) {
  let run = 0
  return createTodoistHumanReconciliationService({
    store,
    newRunId: () => `run-${++run}`,
    pullSelectedProjects: async (input) => {
      expect(input.projectIds).toEqual(['project-1'])
      expect(input.accessToken).toBe('server-token')
      return pulls.shift() ?? pull()
    },
  })
}

describe('Todoist human external-completion vertical slice', () => {
  it('bootstraps only selected-scope checklist mappings without completion or learning', async () => {
    const store = new MemoryStore()
    const sync = service(store, [pull({ completions: [completion()] })])

    const result = await sync({ userId: 'user-1' })

    expect(result).toMatchObject({ disposition: 'bootstrapped', created: 1, cursorAdvanced: true })
    expect(store.items).toEqual([expect.objectContaining({ sourceEntityId: 'todoist-task-1', completed: false })])
    expect(store.ledger).toHaveLength(0)
    expect(store.activityRuns).toHaveLength(0)
    expect(store.behavioralSignals).toHaveLength(0)
    expect(store.recommendedActions[0].status).toBe('proposed')
    expect(store.outcomes).toHaveLength(0)
  })

  it('projects one explicit completion-capable observation through the ambient core', async () => {
    const store = seededStore()
    const sync = service(store, [pull({ completions: [completion()] })])

    const result = await sync({ userId: 'user-1' })

    expect(result).toMatchObject({ disposition: 'reconciled', projected: 1, cursorAdvanced: true })
    expect(store.items[0].completed).toBe(true)
    expect(store.ledger).toHaveLength(1)
    expect(store.activityRuns).toHaveLength(1)
    expect(store.activityEvents).toHaveLength(1)
    expect(store.behavioralSignals).toHaveLength(0)
    expect(store.recommendedActions[0].status).toBe('proposed')
    expect(store.tasks[0].status).toBe('todo')
    expect(store.outcomes).toHaveLength(0)
  })

  it('deduplicates a replay without a second evidence or activity write', async () => {
    const store = seededStore()
    const sync = service(store, [pull({ completions: [completion()] }), pull({ completions: [completion()] })])

    const first = await sync({ userId: 'user-1' })
    const replay = await sync({ userId: 'user-1' })

    expect(first.projected).toBe(1)
    expect(replay).toMatchObject({ disposition: 'reconciled', duplicate: 1 })
    expect(store.ledger).toHaveLength(1)
    expect(store.activityRuns).toHaveLength(1)
  })

  it.each(['missing', 'ambiguous'] as const)('quarantines a %s mapping and keeps the cursor', async (kind) => {
    const store = seededStore()
    if (kind === 'missing') store.items = []
    else store.items.push({ ...store.items[0], id: 'checklist-2' })
    const originalCursor = store.connection!.cursor
    const sync = service(store, [pull({ completions: [completion()] })])

    const result = await sync({ userId: 'user-1' })

    expect(result).toMatchObject({ disposition: 'quarantined', cursorAdvanced: false })
    expect(result.results[0]).toMatchObject({ disposition: 'confirmation_required' })
    expect(store.connection!.cursor).toBe(originalCursor)
    expect(store.ledger).toHaveLength(0)
  })

  it('does not cross user ownership when the remote ID matches', async () => {
    const store = seededStore()
    store.items[0].userId = 'user-2'
    const sync = service(store, [pull({ completions: [completion()] })])

    const result = await sync({ userId: 'user-1' })

    expect(result).toMatchObject({ disposition: 'quarantined', cursorAdvanced: false })
    expect(store.items[0]).toMatchObject({ userId: 'user-2', completed: false })
  })

  it('honors a paused source without projection or cursor advancement', async () => {
    const store = seededStore()
    store.paused.add('user-1:todoist')
    const originalCursor = store.connection!.cursor
    const sync = service(store, [pull({ completions: [completion()] })])

    const result = await sync({ userId: 'user-1' })

    expect(result).toMatchObject({ disposition: 'quarantined', cursorAdvanced: false })
    expect(result.results[0]).toMatchObject({ disposition: 'ignored', reason: 'source_paused' })
    expect(store.items[0].completed).toBe(false)
    expect(store.connection!.cursor).toBe(originalCursor)
  })

  it('keeps the cursor when a later projection fails after an earlier atomic projection', async () => {
    const store = seededStore()
    store.items.push({ ...store.items[0], id: 'checklist-2', sourceEntityId: 'todoist-task-2' })
    store.failSourceId = 'todoist-task-2'
    const originalCursor = store.connection!.cursor
    const sync = service(store, [pull({ completions: [completion(), completion('todoist-task-2', 'event-2')] })])

    await expect(sync({ userId: 'user-1' })).rejects.toThrow('projection_failed')

    expect(store.items[0].completed).toBe(true)
    expect(store.items[1].completed).toBe(false)
    expect(store.connection!.cursor).toBe(originalCursor)
    expect(store.inFlightRunId).toBeNull()
  })

  it('keeps the cursor when final cursor persistence fails after projection', async () => {
    const store = seededStore()
    store.failFinish = true
    const originalCursor = store.connection!.cursor
    const sync = service(store, [pull({ completions: [completion()] })])

    await expect(sync({ userId: 'user-1' })).rejects.toThrow('finish_failed')

    expect(store.items[0].completed).toBe(true)
    expect(store.connection!.cursor).toBe(originalCursor)
    expect(store.inFlightRunId).toBeNull()
  })

  it('never infers completion from absence in an active-task snapshot', async () => {
    const store = seededStore()
    const sync = service(store, [pull({ activeTasks: [], completions: [] })])

    const result = await sync({ userId: 'user-1' })

    expect(result).toMatchObject({ disposition: 'reconciled', projected: 0, cursorAdvanced: true })
    expect(store.items[0].completed).toBe(false)
    expect(store.ledger).toHaveLength(0)
    expect(store.activityRuns).toHaveLength(0)
  })

  it('does not call the provider without a connected, explicitly selected scope', async () => {
    const store = new MemoryStore()
    store.connection = { ...store.connection!, selectedProjectIds: [], scopeKey: '' }
    const provider = jest.fn<Promise<TodoistHumanPullResult>, [unknown]>()
    const sync = createTodoistHumanReconciliationService({ store, pullSelectedProjects: provider as never })

    const result = await sync({ userId: 'user-1' })

    expect(result).toMatchObject({ disposition: 'scope_required', cursorAdvanced: false })
    expect(provider).not.toHaveBeenCalled()
  })
})
