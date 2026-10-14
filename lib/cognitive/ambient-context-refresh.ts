import { prisma } from '@/lib/prisma'
import { runAmbientTwinForUser } from '@/lib/cognitive/ambient-twin-runtime'
import { syncAllPlugins } from '@/lib/plugins/plugin-orchestrator'
import {refreshProjectAssistantForUser} from '@/lib/project-assistant/refresh'

const INTERACTIVE_REFRESH_INTERVAL_MS = 15 * 60 * 1000
const AMBIENT_REFRESH_FINGERPRINT = 'ambient:authorized-sources-refresh'
const AMBIENT_REFRESH_CLAIM_KEY = 'ambient:authorized-sources-refresh-claim'
const AMBIENT_REFRESH_CONCURRENCY = 5
const AMBIENT_REFRESH_CLAIM_TTL_MS = 2 * 60 * 1000

type RefreshSource = 'interactive' | 'background'
type RefreshClaim = { id: string; claimedAt: Date }

function asSettings(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

async function acquireAmbientRefreshClaim(
  userId: string,
  minIntervalMs: number,
  now = new Date(),
): Promise<RefreshClaim | null> {
  const existing = await prisma.ambientReconciliationClaim.findUnique({
    where: { userId_idempotencyKey: { userId, idempotencyKey: AMBIENT_REFRESH_CLAIM_KEY } },
    select: { id: true, status: true, claimedAt: true, claimExpiresAt: true },
  })

  if (existing?.claimedAt && minIntervalMs > 0
    && existing.claimedAt.getTime() >= now.getTime() - minIntervalMs) {
    return null
  }
  if (existing?.status === 'processing' && existing.claimExpiresAt && existing.claimExpiresAt > now) {
    return null
  }

  const claimExpiresAt = new Date(now.getTime() + AMBIENT_REFRESH_CLAIM_TTL_MS)
  if (existing) {
    const acquired = await prisma.ambientReconciliationClaim.updateMany({
      where: {
        id: existing.id,
        userId,
        OR: [
          { status: { not: 'processing' } },
          { claimExpiresAt: { lte: now } },
          { claimExpiresAt: null },
        ],
      },
      data: {
        status: 'processing',
        attempts: { increment: 1 },
        claimedAt: now,
        claimExpiresAt,
        completedAt: null,
        failedAt: null,
        failureCode: null,
        failureMessage: null,
      },
    })
    return acquired.count === 1 ? { id: existing.id, claimedAt: now } : null
  }

  try {
    const created = await prisma.ambientReconciliationClaim.create({
      data: {
        userId,
        provider: 'novo',
        providerAccountId: userId,
        entityType: 'sync_lane',
        sourceEntityId: 'authorized_sources',
        idempotencyKey: AMBIENT_REFRESH_CLAIM_KEY,
        status: 'processing',
        attempts: 1,
        claimedAt: now,
        claimExpiresAt,
      },
      select: { id: true, claimedAt: true },
    })
    return created.claimedAt ? { id: created.id, claimedAt: created.claimedAt } : null
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') return null
    throw error
  }
}

async function finishAmbientRefreshClaim(claim: RefreshClaim, status: 'completed' | 'failed', failureCode?: string) {
  const now = new Date()
  await prisma.ambientReconciliationClaim.updateMany({
    where: { id: claim.id, status: 'processing', claimedAt: claim.claimedAt },
    data: status === 'completed'
      ? { status, completedAt: now, claimExpiresAt: null }
      : { status, failedAt: now, claimExpiresAt: null, failureCode: failureCode?.slice(0, 120) ?? 'ambient_refresh_failed' },
  })
}

async function recordAmbientRefresh(userId: string, sourceRef: RefreshSource) {
  const observedAt = new Date()
  await prisma.novoSignalLedger.upsert({
    where: { userId_fingerprint: { userId, fingerprint: AMBIENT_REFRESH_FINGERPRINT } },
    create: {
      userId,
      fingerprint: AMBIENT_REFRESH_FINGERPRINT,
      source: 'ambient_refresh',
      sourceRef,
      signalType: 'authorized_sources_polled',
      label: 'Authorized sources refreshed',
      observedAt,
      reliability: 'deterministic',
    },
    update: { sourceRef, observedAt, label: 'Authorized sources refreshed', reliability: 'deterministic' },
  })
}

/**
 * Bounded server-side reconciliation of a user's already-authorized sources.
 * A persisted lease makes overlapping tabs, cron invocations and workers safe.
 */
export async function refreshAmbientContextForUser(
  userId: string,
  sourceRef: RefreshSource = 'background',
  options: { minIntervalMs?: number } = {},
) {
  const claim = await acquireAmbientRefreshClaim(userId, options.minIntervalMs ?? 0)
  if (!claim) return { status: 'skipped' as const, reason: 'recent_or_processing' as const }

  try {
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
      select: { settings: true },
    })
    const preferences = asSettings(settings?.settings)
    if (preferences.ambientTwinPaused === true || preferences.cognitiveLearningPaused === true) {
      await finishAmbientRefreshClaim(claim, 'completed')
      return { status: 'skipped' as const, reason: 'paused' as const }
    }

    const plugins = await syncAllPlugins(userId)
    await refreshProjectAssistantForUser(userId)
    const ambient = await runAmbientTwinForUser(userId, { trigger: 'sync' })
    await recordAmbientRefresh(userId, sourceRef)
    await finishAmbientRefreshClaim(claim, 'completed')
    return { status: 'refreshed' as const, plugins, ambient }
  } catch (error) {
    await finishAmbientRefreshClaim(
      claim,
      'failed',
      error instanceof Error ? error.name || 'ambient_refresh_failed' : 'ambient_refresh_failed',
    ).catch(() => undefined)
    throw error
  }
}

/** Keeps an active workspace fresh without allowing navigation to poll repeatedly. */
export async function maybeRefreshAmbientContextForUser(userId: string) {
  const result = await refreshAmbientContextForUser(userId, 'interactive', {
    minIntervalMs: INTERACTIVE_REFRESH_INTERVAL_MS,
  })
  return result.status === 'refreshed'
    ? { refreshed: true as const, result }
    : { refreshed: false as const, reason: result.reason }
}

/** Select never-attempted Twins first, then the least-recently attempted. */
async function selectAmbientRefreshCandidates(limit: number) {
  const neverAttempted = await prisma.user.findMany({
    where: {
      cognitiveTwinRecord: { is: { isInitialized: true } },
      ambientReconciliationClaims: { none: { idempotencyKey: AMBIENT_REFRESH_CLAIM_KEY } },
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })
  if (neverAttempted.length >= limit) return neverAttempted.map((user) => user.id)

  const selected = new Set(neverAttempted.map((user) => user.id))
  const oldestAttempts = await prisma.ambientReconciliationClaim.findMany({
    where: {
      idempotencyKey: AMBIENT_REFRESH_CLAIM_KEY,
      userId: selected.size ? { notIn: [...selected] } : undefined,
      user: { cognitiveTwinRecord: { is: { isInitialized: true } } },
    },
    select: { userId: true },
    orderBy: { claimedAt: 'asc' },
    take: limit - selected.size,
  })
  return [...selected, ...oldestAttempts.map((entry) => entry.userId)]
}

/** Protected cron worker pool. Slow users occupy one lane, not the whole queue. */
export async function refreshAmbientContextForAllUsers(limit = 100) {
  const userIds = await selectAmbientRefreshCandidates(limit)
  let nextIndex = 0
  let succeeded = 0
  let skipped = 0
  let failed = 0

  const worker = async () => {
    while (true) {
      const index = nextIndex++
      if (index >= userIds.length) return
      try {
        const result = await refreshAmbientContextForUser(userIds[index], 'background')
        if (result.status === 'refreshed') succeeded++
        else skipped++
      } catch {
        failed++
      }
    }
  }

  await Promise.all(Array.from(
    { length: Math.min(AMBIENT_REFRESH_CONCURRENCY, userIds.length) },
    () => worker(),
  ))

  return { processed: userIds.length, succeeded, skipped, failed }
}
