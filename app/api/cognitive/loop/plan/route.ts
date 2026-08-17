import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { staleAcceptedAt } from '@/lib/cognitive/action-state-machine'
import { planUserContext } from '@/lib/cognitive/canonical-planner'

const generatePlanSchema = z.object({
  goalId: z.string().cuid().optional(),
  timezone: z.string().trim().min(1).max(100),
  snapshotId: z.string().cuid().optional(),
  runId: z.string().uuid().optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const plan = await prisma.actionPlan.findFirst({
    where: { userId: session.user.id, status: 'active' },
    include: { actions: { orderBy: { priority: 'desc' } }, goal: { select: { title: true } } },
    orderBy: { createdAt: 'desc' },
  })
  const staleActions = plan?.actions.filter((action) => action.status === 'accepted' && staleAcceptedAt(action.statusAt)).map((action) => action.id) ?? []
  return NextResponse.json({ plan, staleActions })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = generatePlanSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid plan request', details: parsed.error.flatten() }, { status: 400 })
  try {
    const result = await planUserContext({ userId: session.user.id, ...parsed.data, trigger: 'user_request' })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'planning_failed'
    if (code === 'goal_not_found') return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    if (code === 'state_snapshot_required') return NextResponse.json({ error: 'Complete a state check-in before generating a plan.' }, { status: 422 })
    if (code === 'no_recommendation') return NextResponse.json({ error: 'Add an objective or an unfinished task before generating a plan.' }, { status: 422 })
    if (code === 'task_completed_during_planning') return NextResponse.json({ error: 'Task completed during planning.' }, { status: 409 })
    if (code === 'activity_run_not_found') return NextResponse.json({ error: 'Activity run not found' }, { status: 404 })
    return NextResponse.json({ error: 'Plan generation failed' }, { status: 500 })
  }
}
