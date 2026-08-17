import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const jsonObject = z.record(z.any())
const cognitiveTwinSyncSchema = z.object({
  identity: jsonObject.optional(),
  energyCurve: jsonObject.optional(),
  metrics: jsonObject.optional(),
  bottlenecks: jsonObject.optional(),
  workspaceLayout: jsonObject.optional(),
  confidenceScore: z.number().finite().min(0).max(100).optional(),
  isInitialized: z.boolean().optional(),
  onboardingCompletedAt: z.string().datetime().nullable().optional(),
  longTermGoal: z.string().trim().max(4_000).optional(),
}).strict()

/**
 * GET /api/cognitive-twin/sync
 * Returns the server-side CognitiveTwinRecord for the authenticated user.
 * Used by CognitiveTwinProvider on mount to hydrate client state.
 * Server record is the single source of truth — always returned in full.
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const record = await prisma.cognitiveTwinRecord.findUnique({
      where: { userId: session.user.id },
      include: {
        evolutionLog: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        snapshots: {
          orderBy: { snapshotDate: 'desc' },
          take: 30,
        },
      },
    })

    if (!record) {
      return NextResponse.json({ twin: null })
    }

    // Explicitly surface the onboarding guard fields so the client
    // can use them for routing guards without deep-parsing the record.
    return NextResponse.json({
      twin: {
        ...record,
        isInitialized: record.isInitialized,
        onboardingCompletedAt: record.onboardingCompletedAt?.toISOString() ?? null,
      }
    })
  } catch (error) {
    console.error('[cognitive-twin/sync GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/cognitive-twin/sync
 * Persists an initial CognitiveTwin from onboarding or partial update to DB.
 * Sets onboardingCompletedAt on first write when isInitialized becomes true.
 *
 * Body: Partial<CognitiveTwin> — same shape as the TypeScript interface
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = cognitiveTwinSyncSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid Cognitive Twin payload', details: parsed.error.flatten() }, { status: 400 })
    }
    const body = parsed.data
    const {
      identity,
      energyCurve,
      metrics,
      bottlenecks,
      workspaceLayout,
      confidenceScore,
      isInitialized,
      onboardingCompletedAt,
      longTermGoal,
    } = body

    const existing = await prisma.cognitiveTwinRecord.findUnique({
      where: { userId: session.user.id },
    })

    // Only set onboardingCompletedAt on first initialization —
    // never overwrite it once it has been set.
    const shouldSetOnboardingDate =
      isInitialized === true &&
      !existing?.onboardingCompletedAt

    const data = {
      ...(identity !== undefined && { identity }),
      ...(energyCurve !== undefined && { energyCurve }),
      ...(metrics !== undefined && { metrics }),
      ...(bottlenecks !== undefined && { bottlenecks }),
      ...(workspaceLayout !== undefined && { workspaceLayout }),
      ...(confidenceScore !== undefined && { confidenceScore }),
      ...(isInitialized !== undefined && { isInitialized }),
      ...(longTermGoal !== undefined && { longTermGoal }),
      // Use provided timestamp if given; otherwise set to now on first init
      ...(shouldSetOnboardingDate && {
        onboardingCompletedAt: onboardingCompletedAt
          ? new Date(onboardingCompletedAt)
          : new Date(),
      }),
    }

    const record = existing
      ? await prisma.cognitiveTwinRecord.update({ where: { userId: session.user.id }, data })
      : await prisma.cognitiveTwinRecord.create({ data: { userId: session.user.id, ...data } })

    return NextResponse.json({
      twin: {
        ...record,
        onboardingCompletedAt: record.onboardingCompletedAt?.toISOString() ?? null,
      }
    })
  } catch (error) {
    console.error('[cognitive-twin/sync POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
