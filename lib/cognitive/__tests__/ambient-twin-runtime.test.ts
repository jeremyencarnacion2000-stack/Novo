jest.mock('@/lib/prisma', () => ({ prisma: {
  userSettings: { findUnique: jest.fn().mockResolvedValue({ settings: {} }) },
  cognitiveTwinRecord: { findUnique: jest.fn().mockResolvedValue({ id: 't1', metrics: {}, confidenceScore: 0, isInitialized: true }) },
  actionPlan: { findFirst: jest.fn().mockResolvedValue(null) },
  task: { findMany: jest.fn().mockResolvedValue([]) },
  calendarEvent: { findMany: jest.fn().mockResolvedValue([]) },
  timeBlock: { findMany: jest.fn().mockResolvedValue([]) },
  twinEvolutionLog: { findMany: jest.fn().mockResolvedValue([]) },
  cognitiveReplanRequest: { findFirst: jest.fn().mockResolvedValue(null) },
  focusSession: { findFirst: jest.fn().mockResolvedValue(null) },
  routine: { findMany: jest.fn().mockResolvedValue([]) },
  outcomeEvent: { findMany: jest.fn().mockResolvedValue([]) },
  behavioralSignal: { findMany: jest.fn().mockResolvedValue([]) },
  novoSignalLedger: { findMany: jest.fn().mockResolvedValue([]) },
  novoSignalSourcePreference: { findMany: jest.fn().mockResolvedValue([]) },
  integrationPermission: { findMany: jest.fn().mockResolvedValue([]) },
} }))

import { readAmbientTwinState } from '../ambient-twin-runtime'

it('reads an honest insufficient-context state without browser dependencies', async () => {
  await expect(readAmbientTwinState('user-1')).resolves.toMatchObject({ status: 'insufficient_context', initiative: 'SILENT_LEARN' })
})

it('surfaces a real active recommendation from persisted Twin context', async () => {
  const { prisma } = jest.requireMock('@/lib/prisma') as { prisma: Record<string, Record<string, jest.Mock>> }
  prisma.cognitiveTwinRecord.findUnique.mockResolvedValue({ id: 't1', metrics: {}, confidenceScore: 88, isInitialized: true })
  prisma.actionPlan.findFirst.mockResolvedValue({ actions: [{ id: 'a1', title: 'Preparar la propuesta', nextStep: 'Abrir el borrador y completar el primer bloque', taskId: 'task-1', estimatedMinutes: 25, confidence: 0.86, explanation: 'Es el siguiente paso del plan activo.', status: 'proposed' }] })
  prisma.task.findMany.mockResolvedValue([{ id: 'task-1', title: 'Preparar la propuesta', status: 'todo', priority: 'high', dueDate: null, updatedAt: new Date() }])

  await expect(readAmbientTwinState('user-1', { trigger: 'task_completed' })).resolves.toMatchObject({
    status: 'active',
    initiative: 'PROACTIVE_SUGGESTION',
    recommendation: { id: 'a1', title: 'Preparar la propuesta' },
    sources: ['twin', 'tasks'],
  })
})

it('asks a targeted question when context matters but confidence is low', async () => {
  const { prisma } = jest.requireMock('@/lib/prisma') as { prisma: Record<string, Record<string, jest.Mock>> }
  prisma.cognitiveTwinRecord.findUnique.mockResolvedValue({ id: 't1', metrics: {}, confidenceScore: 40, isInitialized: true })

  await expect(readAmbientTwinState('user-1', { trigger: 'task_completed' })).resolves.toMatchObject({
    status: 'active',
    initiative: 'ASK_USER',
    question: expect.stringContaining('Preparar la propuesta'),
  })
})

it('includes a durable Gmail aggregate as ambient context without storing mailbox content', async () => {
  const { prisma } = jest.requireMock('@/lib/prisma') as { prisma: Record<string, Record<string, jest.Mock>> }
  prisma.novoSignalLedger.findMany.mockResolvedValue([{ id: 'ledger-1', source: 'gmail', signalType: 'unread_observed', label: 'Gmail inbox observed: 2 unread messages', observedAt: new Date() }])

  await expect(readAmbientTwinState('user-1')).resolves.toMatchObject({
    status: 'active',
    sources: expect.arrayContaining(['gmail']),
  })
})

it('does not treat a device observation alone as Twin context or an ambient trigger', async () => {
  const { prisma } = jest.requireMock('@/lib/prisma') as { prisma: Record<string, Record<string, jest.Mock>> }
  prisma.cognitiveTwinRecord.findUnique.mockResolvedValue(null)
  prisma.actionPlan.findFirst.mockResolvedValue(null)
  prisma.task.findMany.mockResolvedValue([])
  prisma.calendarEvent.findMany.mockResolvedValue([])
  prisma.timeBlock.findMany.mockResolvedValue([])
  prisma.twinEvolutionLog.findMany.mockResolvedValue([])
  prisma.cognitiveReplanRequest.findFirst.mockResolvedValue(null)
  prisma.focusSession.findFirst.mockResolvedValue(null)
  prisma.routine.findMany.mockResolvedValue([])
  prisma.outcomeEvent.findMany.mockResolvedValue([])
  prisma.behavioralSignal.findMany.mockResolvedValue([])
  prisma.novoSignalLedger.findMany.mockResolvedValue([{ id: 'device-1', source: 'device', signalType: 'active_time_daily', label: 'Active time observed: 60 minutes', observedAt: new Date() }])

  await expect(readAmbientTwinState('user-1', { trigger: 'sync' })).resolves.toMatchObject({
    status: 'insufficient_context',
    initiative: 'SILENT_LEARN',
  })
  await expect(readAmbientTwinState('user-1', { trigger: 'sync' })).resolves.not.toMatchObject({ sources: expect.arrayContaining(['device']) })
})

it('does not let derived ambient bookkeeping change its own context fingerprint', async () => {
  const { prisma } = jest.requireMock('@/lib/prisma') as { prisma: Record<string, Record<string, jest.Mock>> }
  const gmailSignal = { id: 'gmail-1', source: 'gmail', signalType: 'unread_observed', label: '2 unread', observedAt: new Date() }
  prisma.novoSignalLedger.findMany
    .mockResolvedValueOnce([
      gmailSignal,
      { id: 'ambient-1', source: 'ambient', signalType: 'current_context_reconciled', label: 'derived', observedAt: new Date() },
      { id: 'refresh-1', source: 'ambient_refresh', signalType: 'authorized_sources_polled', label: 'derived', observedAt: new Date() },
    ])
    .mockResolvedValueOnce([gmailSignal])

  const first = await readAmbientTwinState('user-1')
  const second = await readAmbientTwinState('user-1')

  expect(first.contextFingerprint).toBe(second.contextFingerprint)
  expect(first.sources).toContain('gmail')
})
