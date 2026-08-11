import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'

export type NovoSignalInput = {
  source: 'checkin' | 'goal' | 'task' | 'calendar' | 'outcome'
  sourceRef?: string | null
  signalType: string
  label: string
  observedAt: Date
  reliability: 'user_reported' | 'direct' | 'deterministic' | 'inference'
}

export function signalFingerprint(input: Pick<NovoSignalInput, 'source' | 'sourceRef' | 'signalType'>) {
  return createHash('sha256').update(`${input.source}:${input.sourceRef ?? ''}:${input.signalType}`).digest('hex')
}

export async function upsertNovoSignals(userId: string, signals: NovoSignalInput[]) {
  const userSettings = await prisma.userSettings.findUnique({ where: { userId }, select: { settings: true } })
  const settings = userSettings?.settings && typeof userSettings.settings === 'object' && !Array.isArray(userSettings.settings)
    ? userSettings.settings as Record<string, unknown>
    : {}
  if (settings.cognitiveLearningPaused === true) return
  await Promise.all(signals.map((signal) => prisma.novoSignalLedger.upsert({
    where: { userId_fingerprint: { userId, fingerprint: signalFingerprint(signal) } },
    create: { userId, fingerprint: signalFingerprint(signal), ...signal, sourceRef: signal.sourceRef ?? null },
    update: { label: signal.label, observedAt: signal.observedAt, reliability: signal.reliability },
  })))
}
