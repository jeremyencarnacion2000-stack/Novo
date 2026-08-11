import {
  createAmbientReconciliationService,
  type AmbientReconciliationDependencies,
  type AmbientReconciliationResult,
  type CanonicalObservationVerification,
  type ImportedEntityRecord,
  type NovoExternalObservation,
  type ProjectionIdentity,
  type ReconciliationStore,
  type ReconciliationTransaction,
} from './ambient-reconciliation'

const canonicalProviderVerifications = new Set<CanonicalObservationVerification>([
  'verified_source_state',
  'signed_webhook',
  'deterministic_match',
])

/**
 * The relation is deliberately duplicated with the provider identity. This
 * lets the adapter prove that an MCP caller did not merely name a local row:
 * the row must also resolve through the ambient core's complete provider
 * identity lookup.
 *
 * A route must construct this only after its own trusted, server-side mapping
 * lookup. The adapter additionally binds the core lookup to importedEntityId,
 * so an arbitrary MCP-supplied id cannot broaden the candidate set.
 */
export type VerifiedImportedEntityRelation = ProjectionIdentity & {
  importedEntityId: string
  verified: true
}

export type McpProviderCompletion = {
  provider?: string
  connectionId?: string
  providerAccountId?: string
  entityType?: string
  sourceEntityId?: string
  sourceEventId?: string
  deliveryId?: string
  externalRevision?: string
  occurredAt?: Date
  observedAt?: Date
  fetchedAt?: Date
  verification?: CanonicalObservationVerification
  importedEntityRelation?: VerifiedImportedEntityRelation
}

export type McpProviderCompletionAdapter = (
  caller: { userId: string },
  completion: McpProviderCompletion,
) => Promise<AmbientReconciliationResult>

function confirmation(reason: string): AmbientReconciliationResult {
  return {
    disposition: 'confirmation_required',
    reason,
    recommendationInvalidated: false,
    stalePlanDisposition: 'unchanged',
    learningEligible: false,
  }
}

function hasText(value: string | undefined): value is string {
  return Boolean(value?.trim())
}

function validDate(value: Date | undefined): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime())
}

function relationMatches(
  caller: { userId: string },
  completion: McpProviderCompletion,
  relation: VerifiedImportedEntityRelation,
) {
  return relation.verified
    && relation.userId === caller.userId
    && relation.provider === completion.provider
    && relation.connectionId === completion.connectionId
    && relation.providerAccountId === completion.providerAccountId
    && relation.entityType === completion.entityType
    && relation.sourceEntityId === completion.sourceEntityId
    && hasText(relation.importedEntityId)
}

function relationBoundTransaction(transaction: ReconciliationTransaction, importedEntityId: string): ReconciliationTransaction {
  return {
    ownsConnection: transaction.ownsConnection.bind(transaction),
    isSourcePaused: transaction.isSourcePaused.bind(transaction),
    findLedgerByFingerprint: transaction.findLedgerByFingerprint.bind(transaction),
    findOwnedImportedEntities: async (identity) => (
      await transaction.findOwnedImportedEntities(identity)
    ).filter((entity: ImportedEntityRecord) => entity.id === importedEntityId),
    assessOrdering: transaction.assessOrdering.bind(transaction),
    createLedgerSignal: transaction.createLedgerSignal.bind(transaction),
    projectImportedLifecycle: transaction.projectImportedLifecycle.bind(transaction),
    createActivityRun: transaction.createActivityRun.bind(transaction),
    createActivityEvent: transaction.createActivityEvent.bind(transaction),
  }
}

function relationBoundStore(store: ReconciliationStore, importedEntityId: string): ReconciliationStore {
  return {
    runAtomically: (work) => store.runAtomically((transaction) => (
      work(relationBoundTransaction(transaction, importedEntityId))
    )),
  }
}

/**
 * Normalizes an authenticated MCP/provider completion into the sole ambient
 * reconciliation engine. It never mutates Tasks, RecommendedActions, or
 * OutcomeEvents; `record_recommendation_outcome` remains that explicit path.
 */
export function createMcpProviderCompletionAdapter({
  store,
  now,
}: AmbientReconciliationDependencies): McpProviderCompletionAdapter {
  return async (caller, completion) => {
    if (!hasText(completion.provider)
      || !hasText(completion.connectionId)
      || !hasText(completion.providerAccountId)
      || !hasText(completion.entityType)
      || !hasText(completion.sourceEntityId)
      || !hasText(completion.sourceEventId)) {
      return confirmation('provider_identity_incomplete')
    }

    const relation = completion.importedEntityRelation
    if (!relation) return confirmation('imported_entity_relation_missing')
    if (!relationMatches(caller, completion, relation)) return confirmation('imported_entity_relation_unverified')

    // MCP authentication proves the Novo caller, not the asserted provider
    // completion. A future route must obtain this evidence through the owned
    // provider connection (or a verified provider delivery) before calling
    // this adapter; do not promote missing evidence to deterministic_match.
    if (!completion.verification) return confirmation('verification_evidence_missing')
    if (!canonicalProviderVerifications.has(completion.verification)) return confirmation('verification_not_canonical')

    // An MCP receipt cannot establish a serialized pull ordering boundary.
    // Require provider-documented revision evidence before invoking the core.
    if (!hasText(completion.externalRevision)) return confirmation('ordering_basis_missing')
    if (!validDate(completion.occurredAt) || !validDate(completion.observedAt) || !validDate(completion.fetchedAt)) {
      return confirmation('provider_timestamp_invalid')
    }

    const observation: NovoExternalObservation = {
      userId: caller.userId,
      provider: completion.provider,
      connectionId: completion.connectionId,
      providerAccountId: completion.providerAccountId,
      source: 'mcp',
      sourceEventId: completion.sourceEventId,
      ...(hasText(completion.deliveryId) ? { deliveryId: completion.deliveryId } : {}),
      sourceEntityId: completion.sourceEntityId,
      entityType: completion.entityType,
      kind: 'completed',
      actor: 'agent',
      occurredAt: completion.occurredAt,
      observedAt: completion.observedAt,
      fetchedAt: completion.fetchedAt,
      externalRevision: completion.externalRevision,
      verification: completion.verification,
      rawContentStored: false,
      metadata: { transport: 'mcp', importedEntityId: relation.importedEntityId },
    }

    return createAmbientReconciliationService({
      store: relationBoundStore(store, relation.importedEntityId),
      ...(now ? { now } : {}),
    })(caller, observation)
  }
}
