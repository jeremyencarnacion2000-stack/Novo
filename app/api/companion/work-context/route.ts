import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CompanionError, requireCompanionOAuth } from '@/lib/companion/auth'
import { companionErrorResponse, companionJson, readCompanionJson } from '@/lib/companion/http'
import { requireActiveCompanionDevice } from '@/lib/companion/devices'
import { COMPANION_WORK_CONTEXT_TTL_MS, companionWorkContextInputSchema } from '@/lib/companion/work-context'

export const dynamic = 'force-dynamic'

type WorkContextActor = { userId: string; source: 'web' | 'device'; sourceDeviceId: string | null }
const canClearFrom = (actor: WorkContextActor, sourceDeviceId: string | null) =>
  actor.source === 'web' || actor.sourceDeviceId === sourceDeviceId

async function resolveActor(request: Request, action: 'read' | 'write'): Promise<WorkContextActor> {
  const session = await getServerSession(authOptions)
  if (session?.user?.id) return { userId: session.user.id, source: 'web', sourceDeviceId: null }

  const requiredScope = action === 'read' ? 'device:work-context:read' : 'device:work-context:write'
  const actor = await requireCompanionOAuth(request, ['device:connect', requiredScope])
  const sourceDeviceId = request.headers.get('X-Novo-Device-Id')
  await requireActiveCompanionDevice(actor, sourceDeviceId)
  if (!sourceDeviceId) throw new CompanionError(400, 'device_id_required')
  return { userId: actor.userId, source: 'device', sourceDeviceId }
}

export async function GET(request: Request) {
  try {
    const actor = await resolveActor(request, 'read')
    const row = await prisma.companionWorkContext.findFirst({
      where: { userId: actor.userId, status: 'active', expiresAt: { gt: new Date() } },
      select: { projectLabel: true, focusSummary: true, source: true, sourceDeviceId: true, status: true, observedAt: true, expiresAt: true },
    })
    return companionJson({ context: row ? {
      projectLabel: row.projectLabel,
      focusSummary: row.focusSummary,
      source: row.source,
      status: row.status,
      observedAt: row.observedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      canClear: canClearFrom(actor, row.sourceDeviceId),
    } : null })
  } catch (error) { return companionErrorResponse(error) }
}

export async function POST(request: Request) {
  try {
    const actor = await resolveActor(request, 'write')
    const parsed = companionWorkContextInputSchema.safeParse(await readCompanionJson(request))
    if (!parsed.success) throw new CompanionError(400, 'invalid_work_context')

    const observedAt = new Date()
    const expiresAt = new Date(observedAt.getTime() + COMPANION_WORK_CONTEXT_TTL_MS)
    const data = {
      projectLabel: parsed.data.projectLabel,
      focusSummary: parsed.data.focusSummary.replace(/\s{2,}/g, ' '),
      source: actor.source,
      sourceDeviceId: actor.sourceDeviceId,
      status: 'active',
      observedAt,
      expiresAt,
    }
    const row = await prisma.companionWorkContext.upsert({
      where: { userId: actor.userId },
      create: { userId: actor.userId, ...data },
      update: data,
      select: { projectLabel: true, focusSummary: true, source: true, sourceDeviceId: true, status: true, observedAt: true, expiresAt: true },
    })
    return companionJson({ context: {
      projectLabel: row.projectLabel,
      focusSummary: row.focusSummary,
      source: row.source,
      status: row.status,
      observedAt: row.observedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      canClear: canClearFrom(actor, row.sourceDeviceId),
    } })
  } catch (error) { return companionErrorResponse(error) }
}

export async function DELETE(request: Request) {
  try {
    const actor = await resolveActor(request, 'write')
    await prisma.companionWorkContext.deleteMany({ where: {
      userId: actor.userId,
      ...(actor.sourceDeviceId ? { sourceDeviceId: actor.sourceDeviceId } : {}),
    } })
    return companionJson({ cleared: true })
  } catch (error) { return companionErrorResponse(error) }
}
