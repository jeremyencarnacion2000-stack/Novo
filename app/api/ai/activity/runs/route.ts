import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createActivityRun } from '@/lib/ai/activity'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // This endpoint is intentionally owner-scoped and returns only the most
  // recent operational run. It lets a page reconstruct an in-flight Novo run
  // after a reload without exposing prompts, tokens or private tool payloads.
  const { prisma } = await import('@/lib/prisma')
  const run = await prisma.aiActivityRun.findFirst({
    where: { userId: session.user.id, surface: 'novo_loop', status: { in: ['running', 'awaiting_confirmation'] } },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, phase: true, sequence: true, status: true, updatedAt: true },
  })
  return NextResponse.json({ run })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const surface = body.surface === 'chat' ? 'chat' : body.surface === 'novo_loop' ? 'novo_loop' : body.surface === 'twin_inference' ? 'twin_inference' : null
  if (!surface) return NextResponse.json({ error: 'Invalid activity surface' }, { status: 400 })
  const run = await createActivityRun(session.user.id, surface, typeof body.runId === 'string' ? body.runId : undefined)
  return NextResponse.json({ runId: run.id, phase: run.phase, sequence: run.sequence }, { status: 201 })
}
