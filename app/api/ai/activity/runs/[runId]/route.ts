import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { finishActivityRun, getActivityRun } from '@/lib/ai/activity'
import { prisma } from '@/lib/prisma'
import { trackNovoLoopEvent } from '@/lib/cognitive/events'

export async function GET(request: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { runId } = await params
  const after = Number(new URL(request.url).searchParams.get('after') ?? 0)
  const result = await getActivityRun(session.user.id, runId, Number.isFinite(after) ? after : 0)
  if (!result) return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  return NextResponse.json(result)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { runId } = await params
  const body = await request.json().catch(() => ({}))
  if (body.action === 'telemetry') {
    const run = await prisma.aiActivityRun.findFirst({ where: { id: runId, userId: session.user.id }, select: { id: true } })
    if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    const event = body.event === 'reconnected' ? 'ai_run_reconnected' : body.event === 'polling_fallback' ? 'ai_polling_fallback' : body.event === 'retry' ? 'ai_run_retry' : null
    if (!event) return NextResponse.json({ error: 'Unsupported telemetry event' }, { status: 400 })
    await trackNovoLoopEvent(session.user.id, event, { runId })
    return NextResponse.json({ ok: true })
  }
  if (body.action !== 'cancel') return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  const run = await finishActivityRun(session.user.id, runId, 'cancelled', { errorCode: 'user_cancelled', errorMessage: 'La ejecución fue detenida por el usuario.' })
  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  return NextResponse.json({ run })
}
