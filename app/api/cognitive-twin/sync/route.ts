import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const jsonObject = z.record(z.any())
const cognitiveTwinSyncSchema = z.object({
  // A reset clears derived learning (profile, evolution history and snapshots)
  // while preserving raw behavioral signals so the Twin can learn again from
  // the user's own history. It is intentionally explicit and cannot be mixed
  // with a partial profile update.
  reset: z.literal(true).optional(),
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
 * Server record is the single source of truth for the current Twin profile.
 * Historical timelines are served by their dedicated analytics endpoints.
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // The client calls this endpoint during boot and as a lightweight
    // freshness fallback while the SSE stream is connected.  Do not include
    // the historical evolution log/snapshot collections here: none of those
    // consumers renders history, and returning them every 15 seconds made a
    // small state refresh pay for dozens of extra rows and a much larger
    // response.  History remains available to the dedicated cognitive
    // analytics routes that actually need it.
    const record = await prisma.cognitiveTwinRecord.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        userId: true,
        confidenceScore: true,
        trustLevel: true,
        isInitialized: true,
        onboardingCompletedAt: true,
        longTermGoal: true,
        identity: true,
        energyCurve: true,
        metrics: true,
        bottlenecks: true,
        workspaceLayout: true,
        totalSignals: true,
        updatedAt: true,
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
  } catch {
    console.error('[cognitive-twin/sync GET] Request failed.')
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
    if (body.reset === true) {
      const mixedKeys = Object.keys(body).filter((key) => key !== 'reset')
      if (mixedKeys.length > 0) {
        return NextResponse.json({ error: 'Reset cannot be combined with profile updates' }, { status: 400 })
      }

      const record = await prisma.$transaction(async (tx) => {
        const existing = await tx.cognitiveTwinRecord.findUnique({
          where: { userId: session.user.id },
          select: { id: true },
        })

        if (!existing) {
          return tx.cognitiveTwinRecord.create({
            data: {
              userId: session.user.id,
              confidenceScore: 0,
              trustLevel: 'initial',
              isInitialized: false,
              onboardingCompletedAt: null,
              longTermGoal: '',
              identity: {},
              energyCurve: {},
              metrics: {},
              bottlenecks: {},
              workspaceLayout: {},
              totalSignals: 0,
            },
          })
        }

        // Derived learning is safe to discard. BehavioralSignal rows remain as
        // owned evidence, allowing a fresh Twin to relearn rather than losing
        // the user's history or forcing a full data deletion.
        await Promise.all([
          tx.twinEvolutionLog.deleteMany({ where: { twinId: existing.id, userId: session.user.id } }),
          tx.twinSnapshot.deleteMany({ where: { twinId: existing.id, userId: session.user.id } }),
          tx.twinAgentLog.deleteMany({ where: { twinId: existing.id, userId: session.user.id } }),
        ])

        return tx.cognitiveTwinRecord.update({
          where: { userId: session.user.id },
          data: {
            confidenceScore: 0,
            trustLevel: 'initial',
            isInitialized: false,
            onboardingCompletedAt: null,
            longTermGoal: '',
            identity: {},
            energyCurve: {},
            metrics: {},
            bottlenecks: {},
            workspaceLayout: {},
            totalSignals: 0,
          },
        })
      })

      return NextResponse.json({
        twin: {
          ...record,
          onboardingCompletedAt: record.onboardingCompletedAt?.toISOString() ?? null,
        },
      })
    }

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

    // The previous read-then-create/update flow was racy: two tabs could both
    // observe no record and then one would lose the unique userId race with a
    // 500. Keep creation and partial updates in one database upsert. The
    // onboarding timestamp belongs only to the create branch, so once a Twin
    // exists it can never be overwritten by a later sync payload.
    const data = {
      ...(identity !== undefined && { identity }),
      ...(energyCurve !== undefined && { energyCurve }),
      ...(metrics !== undefined && { metrics }),
      ...(bottlenecks !== undefined && { bottlenecks }),
      ...(workspaceLayout !== undefined && { workspaceLayout }),
      ...(confidenceScore !== undefined && { confidenceScore }),
      ...(isInitialized !== undefined && { isInitialized }),
      ...(longTermGoal !== undefined && { longTermGoal }),
    }

    let record = await prisma.cognitiveTwinRecord.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        ...data,
        // Use the provided timestamp if given; otherwise initialize it now.
        ...(isInitialized === true && {
          onboardingCompletedAt: onboardingCompletedAt
            ? new Date(onboardingCompletedAt)
            : new Date(),
        }),
      },
      update: data,
    })

    // Legacy initialized Twins may predate onboardingCompletedAt. Backfill it
    // with a conditional update so concurrent requests still have one winner
    // and an already-written timestamp is never replaced.
    if (isInitialized === true && !record.onboardingCompletedAt) {
      const completionDate = onboardingCompletedAt
        ? new Date(onboardingCompletedAt)
        : new Date()
      const patched = await prisma.cognitiveTwinRecord.updateMany({
        where: { userId: session.user.id, onboardingCompletedAt: null },
        data: { onboardingCompletedAt: completionDate },
      })
      if (patched.count > 0) {
        record = { ...record, onboardingCompletedAt: completionDate }
      } else {
        const current = await prisma.cognitiveTwinRecord.findUnique({
          where: { userId: session.user.id },
        })
        if (current) record = current
      }
    }

    return NextResponse.json({
      twin: {
        ...record,
        onboardingCompletedAt: record.onboardingCompletedAt?.toISOString() ?? null,
      }
    })
  } catch {
    console.error('[cognitive-twin/sync POST] Request failed.')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
