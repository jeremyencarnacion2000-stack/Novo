jest.mock('@/lib/prisma', () => ({
  prisma: { userSettings: { findUnique: jest.fn() }, novoSignalLedger: { upsert: jest.fn() } },
}))

import { prisma } from '@/lib/prisma'
import { signalFingerprint, upsertNovoSignals } from '../signal-ledger'

describe('signal ledger fingerprints', () => {
  const base = { source: 'task' as const, sourceRef: 'task-1', signalType: 'unfinished_task' }

  it('is stable for the same source reference and signal type', () => {
    expect(signalFingerprint(base)).toBe(signalFingerprint(base))
  })

  it('does not collapse separate signal sources into one ledger entry', () => {
    expect(signalFingerprint(base)).not.toBe(signalFingerprint({ ...base, sourceRef: 'task-2' }))
    expect(signalFingerprint(base)).not.toBe(signalFingerprint({ ...base, signalType: 'deadline' }))
  })

  it('does not append new ledger signals while learning is paused', async () => {
    ;(prisma.userSettings.findUnique as jest.Mock).mockResolvedValue({ settings: { cognitiveLearningPaused: true } })
    await upsertNovoSignals('user-1', [{ ...base, label: 'Task', observedAt: new Date(), reliability: 'direct' }])
    expect(prisma.novoSignalLedger.upsert).not.toHaveBeenCalled()
  })
})
