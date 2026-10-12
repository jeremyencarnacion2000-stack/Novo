import {
  createMutationFingerprint,
  IdempotencyConflictError,
  readIdempotencyKey,
  runIdempotentCreate,
} from '@/lib/server-idempotency'

function requestWithKey(key?: string) {
  return new Request('https://novo.test/api/create', {
    headers: key === undefined ? undefined : { 'Idempotency-Key': key },
  })
}

describe('server idempotency boundary', () => {
  it('normalizes object key order without changing the fingerprint', () => {
    expect(createMutationFingerprint({ b: 2, nested: { z: 1, a: 0 }, a: 1 }))
      .toBe(createMutationFingerprint({ a: 1, nested: { a: 0, z: 1 }, b: 2 }))
  })

  it('validates the key at the HTTP boundary', () => {
    expect(readIdempotencyKey(requestWithKey(' intent-1 '))).toEqual({ key: 'intent-1', invalid: false })
    expect(readIdempotencyKey(requestWithKey('x'.repeat(129))).invalid).toBe(true)
    expect(readIdempotencyKey(requestWithKey(''))).toEqual({ key: null, invalid: true })
  })

  it('replays the resource for the same key and rejects a changed payload', async () => {
    const mutationRequest = {
      findUnique: jest.fn().mockResolvedValue({
        fingerprint: 'same',
        resourceId: 'resource-1',
      }),
      create: jest.fn(),
      update: jest.fn(),
    }
    const resource = { id: 'resource-1', title: 'one' }
    const db = { mutationRequest } as any

    const created = await runIdempotentCreate(db, {
      userId: 'user-1',
      scope: 'test_create',
      idempotencyKey: 'intent-1',
      fingerprint: 'same',
      resourceType: 'test',
      create: async () => resource,
      findResource: async () => resource,
    })

    expect(created).toEqual({ resource, replay: true })

    await expect(runIdempotentCreate(db, {
      userId: 'user-1',
      scope: 'test_create',
      idempotencyKey: 'intent-1',
      fingerprint: 'different',
      resourceType: 'test',
      create: async () => resource,
      findResource: async () => resource,
    })).rejects.toBeInstanceOf(IdempotencyConflictError)
  })

  it('records a new resource and its mutation in one transaction', async () => {
    const mutationRequest = {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'mutation-1' }),
      update: jest.fn().mockResolvedValue({ id: 'mutation-1' }),
    }
    const transactionDb = { mutationRequest }
    const db = {
      mutationRequest,
      $transaction: jest.fn(async (callback: (tx: typeof transactionDb) => Promise<unknown>) => callback(transactionDb)),
    } as any
    const resource = { id: 'resource-2', title: 'created' }

    const result = await runIdempotentCreate(db, {
      userId: 'user-1',
      scope: 'test_create',
      idempotencyKey: 'intent-2',
      fingerprint: 'payload',
      resourceType: 'test',
      create: async () => resource,
      findResource: async () => resource,
    })

    expect(result).toEqual({ resource, replay: false })
    expect(mutationRequest.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ resourceId: 'pending', idempotencyKey: 'intent-2' }),
    }))
    expect(mutationRequest.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { resourceId: 'resource-2' },
    }))
  })
})
