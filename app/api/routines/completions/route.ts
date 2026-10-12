import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { emitTwinSignal } from '@/lib/twin-signal'

const IDEMPOTENCY_KEY_MAX_LENGTH = 128
const ROUTINE_COMPLETION_SCOPE = 'routine_completion'

function isUniqueConstraintError(error: unknown): error is { code: string } {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

function completionResponse(completion: unknown, replay: boolean) {
    const response = NextResponse.json(completion, { status: replay ? 200 : 201 })
    response.headers.set('X-Idempotent-Replay', String(replay))
    return response
}

// POST - Log a routine completion
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { routineId, tasksTotal, tasksCompleted } = body

        if (!routineId) {
            return NextResponse.json({ error: 'Routine ID is required' }, { status: 400 })
        }

        // Verify the routine belongs to the user
        const routine = await prisma.routine.findFirst({
            where: { id: routineId, userId: session.user.id },
        })

        if (!routine) {
            return NextResponse.json({ error: 'Routine not found' }, { status: 404 })
        }

        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
        const todayDay = days[new Date().getDay()]
        const normalizedTasksTotal = Number.isInteger(tasksTotal) && tasksTotal >= 0 ? tasksTotal : 0
        const normalizedTasksCompleted = Number.isInteger(tasksCompleted) && tasksCompleted >= 0 ? tasksCompleted : 0
        const rawIdempotencyKey = request.headers.get('Idempotency-Key')
        const idempotencyKey = rawIdempotencyKey?.trim() || null
        if (idempotencyKey && idempotencyKey.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
            return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 })
        }
        const fingerprint = JSON.stringify({
            routineId,
            tasksTotal: normalizedTasksTotal,
            tasksCompleted: normalizedTasksCompleted,
            scheduledDay: todayDay,
        })

        if (idempotencyKey) {
            const existing = await prisma.mutationRequest.findUnique({
                where: {
                    userId_scope_idempotencyKey: {
                        userId: session.user.id,
                        scope: ROUTINE_COMPLETION_SCOPE,
                        idempotencyKey,
                    },
                },
            })
            if (existing) {
                if (existing.fingerprint !== fingerprint) {
                    return NextResponse.json({ error: 'Idempotency key was already used for another request' }, { status: 409 })
                }
                const existingCompletion = await prisma.routineCompletion.findFirst({
                    where: { id: existing.resourceId, routine: { userId: session.user.id } },
                })
                if (existingCompletion) return completionResponse(existingCompletion, true)
                return NextResponse.json({ error: 'Idempotent request result is unavailable' }, { status: 409 })
            }
        }

        const createCompletion = (db: typeof prisma) => db.routineCompletion.create({
            data: {
                routineId,
                tasksTotal: normalizedTasksTotal,
                tasksCompleted: normalizedTasksCompleted,
                scheduledDay: todayDay,
            },
        })

        let completion
        let replay = false
        if (!idempotencyKey) {
            completion = await createCompletion(prisma)
        } else {
            try {
                completion = await prisma.$transaction(async (tx) => {
                    await tx.mutationRequest.create({
                        data: {
                            userId: session.user.id,
                            scope: ROUTINE_COMPLETION_SCOPE,
                            idempotencyKey,
                            fingerprint,
                            resourceType: 'routine_completion',
                            resourceId: 'pending',
                        },
                    })
                    const created = await createCompletion(tx as typeof prisma)
                    await tx.mutationRequest.update({
                        where: {
                            userId_scope_idempotencyKey: {
                                userId: session.user.id,
                                scope: ROUTINE_COMPLETION_SCOPE,
                                idempotencyKey,
                            },
                        },
                        data: { resourceId: created.id },
                    })
                    return created
                })
            } catch (error) {
                if (isUniqueConstraintError(error)) {
                    const winner = await prisma.mutationRequest.findUnique({
                        where: {
                            userId_scope_idempotencyKey: {
                                userId: session.user.id,
                                scope: ROUTINE_COMPLETION_SCOPE,
                                idempotencyKey,
                            },
                        },
                    })
                    if (winner && winner.fingerprint === fingerprint && winner.resourceId !== 'pending') {
                        const winnerCompletion = await prisma.routineCompletion.findFirst({
                            where: { id: winner.resourceId, routine: { userId: session.user.id } },
                        })
                        if (winnerCompletion) {
                            completion = winnerCompletion
                            replay = true
                        }
                    }
                }
                if (!completion) throw error
            }
        }

        // Track analytics
        const { trackServerCompletion } = await import('@/lib/analytics-server')
        if (!replay) await trackServerCompletion(session.user.id, 'routine', 'routines', {
            routineId,
            routineName: routine.name,
            tasksCompleted: normalizedTasksCompleted,
            tasksTotal: normalizedTasksTotal
        })

        // Emit behavioral signal: completed if >50% tasks done, skipped if 0% (fire-and-forget)
        if (!replay) {
            const completedRatio = normalizedTasksTotal > 0 ? normalizedTasksCompleted / normalizedTasksTotal : 0
            const signalType = completedRatio === 0 ? 'routine_skipped' : 'routine_completed'
            emitTwinSignal({ userId: session.user.id, signal: signalType })
        }

        return completionResponse(completion, replay)
    } catch (error) {
        console.error('Error logging routine completion.')
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// GET - Get completion history and stats for user's routines
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { id: true },
        })

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const { searchParams } = new URL(request.url)
        const routineId = searchParams.get('routineId')
        const requestedDays = Number.parseInt(searchParams.get('days') || '30', 10)
        // Completion history is a compact in-app signal. Bound the date
        // window so a malformed URL cannot trigger a huge date loop or an
        // unbounded completion query.
        const days = Number.isFinite(requestedDays)
            ? Math.min(Math.max(requestedDays, 1), 365)
            : 30

        const dateLimit = new Date()
        dateLimit.setDate(dateLimit.getDate() - days)

        // Get user's routines
        const routines = await prisma.routine.findMany({
            where: { userId: user.id },
            select: { id: true, name: true },
        })

        const routineIds = routines.map(r => r.id)

        // Scope a requested routine to the authenticated user's own list
        // before querying completions. Without this check, a valid routine id
        // belonging to another account could be used as a read selector.
        if (routineId && !routineIds.includes(routineId)) {
            return NextResponse.json({ error: 'Routine not found' }, { status: 404 })
        }

        // Filter by specific routine if provided
        const whereClause = routineId
            ? { routineId, completedAt: { gte: dateLimit } }
            : { routineId: { in: routineIds }, completedAt: { gte: dateLimit } }

        const completions = await prisma.routineCompletion.findMany({
            where: whereClause,
            orderBy: { completedAt: 'desc' },
            include: { routine: { select: { name: true } } },
        })

        // Calculate stats
        const totalCompletions = completions.length

        // Calculate current streak (consecutive days with at least one completion)
        let currentStreak = 0
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const completionDates = [...new Set(
            completions.map(c => {
                const d = new Date(c.completedAt)
                d.setHours(0, 0, 0, 0)
                return d.getTime()
            })
        )].sort((a, b) => b - a)

        for (let i = 0; i < days; i++) {
            const checkDate = new Date(today)
            checkDate.setDate(checkDate.getDate() - i)
            checkDate.setHours(0, 0, 0, 0)

            if (completionDates.includes(checkDate.getTime())) {
                currentStreak++
            } else if (i > 0) {
                break
            }
        }

        // Calculate completion rate
        const completionRate = routineIds.length > 0
            ? Math.round((totalCompletions / (days * routineIds.length)) * 100)
            : 0

        return NextResponse.json({
            completions,
            stats: {
                totalCompletions,
                currentStreak,
                completionRate: Math.min(completionRate, 100),
                period: days,
            },
        })
    } catch (error) {
        console.error('Error fetching routine completions.')
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
