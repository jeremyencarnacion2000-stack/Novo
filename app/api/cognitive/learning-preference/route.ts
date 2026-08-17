import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateSchema = z.object({ paused: z.boolean() })
const preferenceKey = 'cognitiveLearningPaused'

function isPaused(settings: unknown) {
  return Boolean(settings && typeof settings === 'object' && !Array.isArray(settings) && (settings as Record<string, unknown>)[preferenceKey] === true)
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userSettings = await prisma.userSettings.findUnique({ where: { userId: session.user.id }, select: { settings: true } })
  return NextResponse.json({ paused: isPaused(userSettings?.settings) })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid learning preference' }, { status: 400 })
  }
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid learning preference' }, { status: 400 })

  const existing = await prisma.userSettings.findUnique({ where: { userId: session.user.id }, select: { settings: true } })
  const current = existing?.settings && typeof existing.settings === 'object' && !Array.isArray(existing.settings) ? existing.settings as Record<string, unknown> : {}
  const settings = { ...current, [preferenceKey]: parsed.data.paused }
  await prisma.userSettings.upsert({
    where: { userId: session.user.id },
    update: { settings },
    create: { userId: session.user.id, settings },
  })
  return NextResponse.json({ paused: parsed.data.paused })
}
