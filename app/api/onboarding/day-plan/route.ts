import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateAndExecuteDayPlan, type DayPlanTrigger } from '@/lib/ai/day-plan-generator'
import { trackNovoLoopEvent } from '@/lib/cognitive/events'

// Called from the onboarding page right after the Twin analysis resolves
// (trigger='onboarding', the default) — and also from the peak-focus
// orchestrator whenever a focus window opens with no pending tasks
// (trigger='peak_focus') — so the Twin keeps generating and executing a
// calibrated plan whenever there's nothing else queued, not just once at
// signup. Same generator, same real task/event creation, either caller.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { twin, trigger } = await req.json()
    const result = await generateAndExecuteDayPlan(session.user.id, twin || {}, (trigger as DayPlanTrigger) || 'onboarding')
    if ((trigger as DayPlanTrigger | undefined) === 'onboarding') {
      await trackNovoLoopEvent(session.user.id, 'first_plan_generated', {
        taskCount: result.tasks.length,
        hasCalendarBlock: Boolean(result.event),
      })
    }
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[Onboarding Day Plan]', error)
    return NextResponse.json({ error: error.message || 'Error generating day plan' }, { status: 500 })
  }
}
