import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'

export type NovoSignalInput = {
  source: 'checkin' | 'goal' | 'task' | 'calendar' | 'outcome'
    | 'gmail' | 'notion' | 'todoist' | 'slack' | 'github' | 'device' | 'vercel'
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
  const preferences = await prisma.novoSignalSourcePreference.findMany({
    where: { userId, source: { in: [...new Set(signals.map((signal) => signal.source))] }, excludedAt: { not: null } },
    select: { source: true },
  })
  const excludedSources = new Set((preferences ?? []).map((preference) => preference.source))
  const acceptedSignals = signals.filter((signal) => !excludedSources.has(signal.source))
  await Promise.all(acceptedSignals.map((signal) => prisma.novoSignalLedger.upsert({
    where: { userId_fingerprint: { userId, fingerprint: signalFingerprint(signal) } },
    create: { userId, fingerprint: signalFingerprint(signal), ...signal, sourceRef: signal.sourceRef ?? null },
    update: { label: signal.label, observedAt: signal.observedAt, reliability: signal.reliability },
  })))
}
