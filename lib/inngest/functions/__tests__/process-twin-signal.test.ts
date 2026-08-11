jest.mock('@/lib/prisma', () => ({
  prisma: {
    userSettings: { findUnique: jest.fn() },
    cognitiveTwinRecord: { findUnique: jest.fn() },
  },
}))

jest.mock('@/lib/ai/activity', () => ({
  appendActivityEvent: jest.fn(),
  createActivityRun: jest.fn(),
  finishActivityRun: jest.fn(),
}))

jest.mock('@/lib/cognitive/twin-agent', () => ({ runTwinAgent: jest.fn() }))

import { prisma } from '@/lib/prisma'
import { createActivityRun, finishActivityRun } from '@/lib/ai/activity'
import { processTwinSignalHandler } from '../process-twin-signal'

describe('processTwinSignalHandler learning pause', () => {
  it('stops before appending behavior when learning is paused', async () => {
    ;(prisma.userSettings.findUnique as jest.Mock).mockResolvedValue({ settings: { cognitiveLearningPaused: true } })
    const step = { run: jest.fn() }

    await expect(processTwinSignalHandler({ event: { data: { userId: 'user-1', signal: 'task_created', hour: 10 } }, step })).resolves.toEqual({ paused: true })
    expect(step.run).not.toHaveBeenCalled()
  })

  it('marks the inference run failed before rethrowing a durable-step error', async () => {
    ;(prisma.userSettings.findUnique as jest.Mock).mockResolvedValue({ settings: {} })
    ;(createActivityRun as jest.Mock).mockResolvedValue({ id: 'inference-run-1' })
    ;(prisma.cognitiveTwinRecord.findUnique as jest.Mock).mockRejectedValue(new Error('database unavailable'))
    const step: { run: <T>(name: string, work: () => T | Promise<T>) => Promise<T> } = {
      run: jest.fn(async <T>(_name: string, work: () => T | Promise<T>) => work()),
    }

    await expect(processTwinSignalHandler({ event: { data: { userId: 'user-1', signal: 'task_created', hour: 10 } }, step })).rejects.toThrow('database unavailable')
    expect(finishActivityRun).toHaveBeenCalledWith(
      'user-1',
      'inference-run-1',
      'failed',
      expect.objectContaining({ errorCode: 'twin_inference_failed' }),
    )
  })
})
