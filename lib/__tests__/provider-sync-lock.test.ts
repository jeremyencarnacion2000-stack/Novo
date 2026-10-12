/** @jest-environment node */

import { withProviderSyncLock } from '../provider-sync-lock'

describe('withProviderSyncLock', () => {
  it('takes a transaction-scoped advisory lock before reconciliation', async () => {
    const executeRaw = jest.fn().mockResolvedValue(1)
    const transaction = jest.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({ $executeRaw: executeRaw }),
    )
    const db = { $transaction: transaction } as never

    await expect(withProviderSyncLock(db, 'novo:sync:user-1:todoist', async () => 'ok'))
      .resolves.toBe('ok')

    expect(transaction).toHaveBeenCalledTimes(1)
    expect(executeRaw).toHaveBeenCalledTimes(1)
    expect(executeRaw.mock.calls[0]?.[0]).toEqual(expect.anything())
  })

  it('keeps test doubles and lightweight adapters working without transactions', async () => {
    const db = {} as never
    const work = jest.fn().mockResolvedValue('fallback')

    await expect(withProviderSyncLock(db, 'novo:sync:user-1:notion', work)).resolves.toBe('fallback')
    expect(work).toHaveBeenCalledTimes(1)
  })
})
