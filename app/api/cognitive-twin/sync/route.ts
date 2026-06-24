import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

    const body = await request.json()
    const {
      identity,
      energyCurve,
      metrics,
      bottlenecks,
      workspaceLayout,
      confidenceScore,
      isInitialized,
      onboardingCompletedAt,
    } = body

    const existing = await prisma.cognitiveTwinRecord.findUnique({
      where: { userId: session.user.id },
    })

    // Only set onboardingCompletedAt on first initialization —
    // never overwrite it once it has been set.
    const shouldSetOnboardingDate =
      isInitialized === true &&
      !existing?.onboardingCompletedAt &&
      !existing?.isInitialized

    const data = {
      ...(identity !== undefined && { identity }),
      ...(energyCurve !== undefined && { energyCurve }),
      ...(metrics !== undefined && { metrics }),
      ...(bottlenecks !== undefined && { bottlenecks }),
      ...(workspaceLayout !== undefined && { workspaceLayout }),
      ...(confidenceScore !== undefined && { confidenceScore }),
      ...(isInitialized !== undefined && { isInitialized }),
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
