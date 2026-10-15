import { prisma } from '@/lib/prisma'
import { after } from 'next/server'
import { CompanionError, requireCompanionOAuth } from '@/lib/companion/auth'
import { companionErrorResponse, companionJson, readCompanionJson } from '@/lib/companion/http'
import { requireActiveCompanionDevice } from '@/lib/companion/devices'
import { codexContextInputSchema, codexSignalUpdates } from '@/lib/companion/codex-context'
import { runAmbientTwinForUser } from '@/lib/cognitive/ambient-twin-runtime'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const actor = await requireCompanionOAuth(request, ['device:connect', 'device:work-context:write'])
    const deviceId = request.headers.get('X-Novo-Device-Id')
    await requireActiveCompanionDevice(actor, deviceId)
    const parsed = codexContextInputSchema.safeParse(await readCompanionJson(request, 4096))
    if (!parsed.success) throw new CompanionError(400, 'invalid_codex_context')

    const preference = await prisma.novoSignalSourcePreference.findUnique({
      where: { userId_source: { userId: actor.userId, source: 'codex' } },
      select: { excludedAt: true },
    })
    if (preference?.excludedAt) return companionJson({ synced: false, excluded: true })

    const updates = codexSignalUpdates(parsed.data)
    const receivedAt = new Date()
    const reportedAt = parsed.data.observedAt ? new Date(parsed.data.observedAt) : receivedAt
    // Keep a reasonable local event time for ordering; a skewed system clock
    // cannot make Codex context appear future-dated or stale indefinitely.
    const observedAt = Math.abs(reportedAt.getTime() - receivedAt.getTime()) <= 5 * 60_000
      ? reportedAt
      : receivedAt

    for (const signal of updates) {
      await prisma.novoSignalLedger.upsert({
        where: { userId_fingerprint: { userId: actor.userId, fingerprint: signal.fingerprint } },
        create: {
          userId: actor.userId,
          fingerprint: signal.fingerprint,
          source: 'codex',
          sourceRef: signal.sourceRef,
          signalType: signal.signalType,
          label: signal.label,
          observedAt,
          reliability: 'direct',
        },
        update: {
          sourceRef: signal.sourceRef,
          signalType: signal.signalType,
          label: signal.label,
          observedAt,
          reliability: 'direct',
        },
      })
    }

    if ((parsed.data.event === 'stop' || parsed.data.event === 'stop_failure') && parsed.data.summary) {
      after(async () => {
        await runAmbientTwinForUser(actor.userId, { trigger: 'sync' }).catch(() => undefined)
      })
    }

    return companionJson({ synced: true, source: 'codex', updated: updates.length })
  } catch (error) {
    return companionErrorResponse(error)
  }
}
