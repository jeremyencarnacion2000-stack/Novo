import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { emitTwinSignal } from '@/lib/twin-signal'

// POST - Log a routine completion
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        })

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const body = await request.json()
        const { routineId, tasksTotal, tasksCompleted } = body

        if (!routineId) {
            return NextResponse.json({ error: 'Routine ID is required' }, { status: 400 })
        }

        // Verify the routine belongs to the user
        const routine = await prisma.routine.findFirst({
            where: { id: routineId, userId: user.id },
        })

        if (!routine) {
            return NextResponse.json({ error: 'Routine not found' }, { status: 404 })
        }

        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
        const todayDay = days[new Date().getDay()]

        const completion = await prisma.routineCompletion.create({
            data: {
                routineId,
                tasksTotal: tasksTotal || 0,
                tasksCompleted: tasksCompleted || 0,
                scheduledDay: todayDay,
            },
        })

        // Track analytics
        const { trackServerCompletion } = await import('@/lib/analytics-server')
        await trackServerCompletion(user.id, 'routine', 'routines', {
            routineId,
            routineName: routine.name,
            tasksCompleted: tasksCompleted || 0,
            tasksTotal: tasksTotal || 0
        })

        // Emit behavioral signal: completed if >50% tasks done, skipped if 0% (fire-and-forget)
        const completedRatio = tasksTotal > 0 ? (tasksCompleted || 0) / tasksTotal : 0
        const signalType = completedRatio === 0 ? 'routine_skipped' : 'routine_completed'
        emitTwinSignal({ userId: user.id, signal: signalType })

        return NextResponse.json(completion)
    } catch (error) {
        console.error('Error logging routine completion:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// GET - Get completion history and stats for user's routines
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        })

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const { searchParams } = new URL(request.url)
        const routineId = searchParams.get('routineId')
        const days = parseInt(searchParams.get('days') || '30', 10)

        const dateLimit = new Date()
        dateLimit.setDate(dateLimit.getDate() - days)

        // Get user's routines
        const routines = await prisma.routine.findMany({
            where: { userId: user.id },
            select: { id: true, name: true },
        })

        const routineIds = routines.map(r => r.id)

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
        console.error('Error fetching routine completions:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
