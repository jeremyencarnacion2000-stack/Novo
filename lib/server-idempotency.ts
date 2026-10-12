import type { Prisma, PrismaClient } from '@prisma/client'

/**
 * Shared server-side boundary for user initiated creates.
 *
 * A client key represents one intent, not one piece of content.  This means
 * two intentionally identical tasks are still allowed, while a transport
 * retry converges on the resource created by the first request.
 */
export const IDEMPOTENCY_KEY_MAX_LENGTH = 128

export type IdempotencyDb = PrismaClient | Prisma.TransactionClient

export class IdempotencyConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IdempotencyConflictError'
  }
}

export function readIdempotencyKey(request: Request): { key: string | null; invalid: boolean } {
  const raw = request.headers.get('Idempotency-Key')
  const key = raw?.trim() || null
  return {
    key,
    invalid: raw !== null && (!key || key.length > IDEMPOTENCY_KEY_MAX_LENGTH),
  }
}

function normalizeForFingerprint(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeForFingerprint)
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, normalizeForFingerprint(nested)])
    )
  }
  return value
}

/** Stable across JSON property ordering, so harmless client serialization changes do not cause a false conflict. */
export function createMutationFingerprint(value: unknown): string {
  return JSON.stringify(normalizeForFingerprint(value))
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

export async function runIdempotentCreate<T extends { id: string }>(
  db: PrismaClient,
  options: {
    userId: string
    scope: string
    idempotencyKey: string | null
    fingerprint: string
    resourceType: string
    create: (transactionDb: IdempotencyDb) => Promise<T>
    findResource: (resourceId: string, resourceDb: IdempotencyDb) => Promise<T | null>
  }
): Promise<{ resource: T; replay: boolean }> {
  const { userId, scope, idempotencyKey, fingerprint, resourceType, create, findResource } = options

  if (!idempotencyKey) {
    return { resource: await create(db), replay: false }
  }

  const mutationWhere = {
    userId_scope_idempotencyKey: { userId, scope, idempotencyKey },
  }
  const existing = await db.mutationRequest.findUnique({ where: mutationWhere })
  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      throw new IdempotencyConflictError('Idempotency key was already used for another request')
    }
    const resource = existing.resourceId === 'pending' ? null : await findResource(existing.resourceId, db)
    if (resource) return { resource, replay: true }
    throw new IdempotencyConflictError('Idempotent request result is unavailable')
  }

  try {
    const resource = await db.$transaction(async (transactionDb) => {
      await transactionDb.mutationRequest.create({
        data: {
          userId,
          scope,
          idempotencyKey,
          fingerprint,
          resourceType,
          resourceId: 'pending',
        },
      })
      const created = await create(transactionDb)
      await transactionDb.mutationRequest.update({
        where: { userId_scope_idempotencyKey: { userId, scope, idempotencyKey } },
        data: { resourceId: created.id },
      })
      return created
    })
    return { resource, replay: false }
  } catch (error) {
    // Another request may have won the unique key race. Resolve to that
    // resource instead of turning a normal network retry into a 500.
    if (isUniqueConstraintError(error)) {
      const winner = await db.mutationRequest.findUnique({ where: mutationWhere })
      if (winner) {
        if (winner.fingerprint !== fingerprint) {
          throw new IdempotencyConflictError('Idempotency key was already used for another request')
        }
        if (winner.resourceId !== 'pending') {
          const resource = await findResource(winner.resourceId, db)
          if (resource) return { resource, replay: true }
        }
        throw new IdempotencyConflictError('Idempotent request result is unavailable')
      }
    }
    throw error
  }
}
