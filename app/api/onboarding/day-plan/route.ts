import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateAndExecuteDayPlan, type DayPlanTrigger } from '@/lib/ai/day-plan-generator'
import { trackNovoLoopEvent } from '@/lib/cognitive/events'
import { z } from 'zod'

const MAX_DAY_PLAN_BODY_BYTES = 32_000
const dayPlanTwinSchema = z.object({
  longTermGoal: z.string().max(2_000).optional(),
  identity: z.object({ role: z.string().max(100).optional() }).optional(),
  energyCurve: z.object({
    chronotype: z.string().max(100).optional(),
    peakFocusStart: z.string().max(20).optional(),
    peakFocusEnd: z.string().max(20).optional(),
  }).optional(),
  bottlenecks: z.object({ mainFrictionPoint: z.string().max(200).optional() }).optional(),
}).default({})

const dayPlanRequestSchema = z.object({
  twin: dayPlanTwinSchema.optional(),
  trigger: z.enum(['onboarding', 'peak_focus', 'manual']).default('onboarding'),
}).strict()

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
    const contentLength = Number(req.headers.get('content-length'))
    if (Number.isFinite(contentLength) && contentLength > MAX_DAY_PLAN_BODY_BYTES) {
      return NextResponse.json({ error: 'Day plan payload is too large' }, { status: 413 })
    }

    const parsed = dayPlanRequestSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid day plan request' }, { status: 400 })
    }

    const { trigger } = parsed.data
    const result = await generateAndExecuteDayPlan(session.user.id, parsed.data.twin ?? {}, trigger as DayPlanTrigger)
    if (trigger === 'onboarding') {
      await trackNovoLoopEvent(session.user.id, 'first_plan_generated', {
        taskCount: result.tasks.length,
        hasCalendarBlock: Boolean(result.event),
      })
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error('[Onboarding Day Plan] Request failed.')
    return NextResponse.json({ error: 'Unable to generate your day plan right now' }, { status: 500 })
  }
}
