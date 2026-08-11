import { actionResponseSchema } from '../cognitive-loop'

const base = { actionId: 'ck1234567890123456789012345', response: 'modified', idempotencyKey: '00000000-0000-4000-8000-000000000001' }

describe('cognitive loop modification contract', () => {
  it('accepts a bounded replacement next step', () => {
    expect(actionResponseSchema.safeParse({ ...base, modifiedNextStep: 'Reduce the first action to one testable task.' }).success).toBe(true)
  })

  it('rejects an empty modification instead of persisting a blank action', () => {
    expect(actionResponseSchema.safeParse({ ...base, modifiedNextStep: ' ' }).success).toBe(false)
  })

  it('rejects abandonment without a structured reason so later plans can learn from it', () => {
    const result = actionResponseSchema.safeParse({
      actionId: base.actionId,
      response: 'abandoned',
      idempotencyKey: base.idempotencyKey,
    })

    expect(result.success).toBe(false)
  })

  it('accepts a known abandonment reason', () => {
    const result = actionResponseSchema.safeParse({
      actionId: base.actionId,
      response: 'abandoned',
      reason: 'too_large',
      idempotencyKey: base.idempotencyKey,
    })

    expect(result.success).toBe(true)
  })
})
