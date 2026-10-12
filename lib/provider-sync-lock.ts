import type { Prisma, PrismaClient } from '@prisma/client'

/**
 * Serializes the small database reconciliation window for a provider.
 *
 * Provider APIs are read outside this lock. Only the read/update-or-create
 * section is protected, so a slow upstream request never blocks another
 * user's sync. PostgreSQL advisory locks work across serverless instances and
 * are released automatically with the transaction.
 *
 * The fallback keeps lightweight unit-test doubles usable; the real Prisma
 * client always has `$transaction` and takes the lock.
 */
export async function withProviderSyncLock<T>(
  db: PrismaClient,
  lockKey: string,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const maybeDb = db as PrismaClient & { $transaction?: unknown }
  if (typeof maybeDb.$transaction !== 'function') {
    return work(db as unknown as Prisma.TransactionClient)
  }

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`
    return work(tx)
  })
}
