import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { runAmbientTwinForUser } from '@/lib/cognitive/ambient-twin-runtime'

const mutation = z.object({
  signalId: z.string().cuid().optional(),
  action: z.enum(['exclude', 'restore', 'correct', 'exclude_source', 'restore_source']),
  source: z.enum(['checkin', 'goal', 'task', 'calendar', 'outcome']).optional(),
  reason: z.string().trim().max(240).optional(),
  correction: z.string().trim().min(1).max(240).optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [signals, sourcePreferences] = await Promise.all([
    prisma.novoSignalLedger.findMany({ where: { userId: session.user.id }, orderBy: { observedAt: 'desc' }, take: 100 }),
    prisma.novoSignalSourcePreference.findMany({ where: { userId: session.user.id }, orderBy: { updatedAt: 'desc' } }),
  ])
  return NextResponse.json({ signals, sourcePreferences })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = mutation.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid signal correction', details: parsed.error.flatten() }, { status: 400 })
  const { signalId, action, reason, correction } = parsed.data
  if (action === 'correct' && !correction) return NextResponse.json({ error: 'A correction is required' }, { status: 400 })
  if (['exclude_source', 'restore_source'].includes(action) && !parsed.data.source) return NextResponse.json({ error: 'A signal source is required' }, { status: 400 })
  if (!['exclude_source', 'restore_source'].includes(action) && !signalId) return NextResponse.json({ error: 'A signal is required' }, { status: 400 })
  if (action === 'exclude_source' || action === 'restore_source') {
    const preference = await prisma.novoSignalSourcePreference.upsert({
      where: { userId_source: { userId: session.user.id, source: parsed.data.source! } },
      create: { userId: session.user.id, source: parsed.data.source!, excludedAt: action === 'exclude_source' ? new Date() : null, reason: action === 'exclude_source' ? reason ?? 'user_excluded_source' : null },
      update: action === 'exclude_source' ? { excludedAt: new Date(), reason: reason ?? 'user_excluded_source' } : { excludedAt: null, reason: null },
    })
    void runAmbientTwinForUser(session.user.id, { trigger: 'user_correction' }).catch(() => undefined)
    return NextResponse.json({ sourcePreference: preference })
  }
  const signal = await prisma.novoSignalLedger.findFirst({ where: { id: signalId, userId: session.user.id } })
  if (!signal) return NextResponse.json({ error: 'Signal not found' }, { status: 404 })
  const updated = await prisma.novoSignalLedger.update({ where: { id: signal.id }, data: action === 'exclude'
    ? { excludedAt: new Date(), exclusionReason: reason ?? 'user_excluded' }
    : action === 'restore' ? { excludedAt: null, exclusionReason: null }
      : { correctedAt: new Date(), correction },
  })
  void runAmbientTwinForUser(session.user.id, { trigger: action === 'correct' ? 'user_correction' : 'sync' }).catch(() => undefined)
  return NextResponse.json({ signal: updated })
}
