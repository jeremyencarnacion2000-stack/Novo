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
