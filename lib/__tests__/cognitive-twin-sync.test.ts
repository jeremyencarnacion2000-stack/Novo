import { toCognitiveTwinSyncPayload } from '@/lib/cognitive-twin-sync'

describe('toCognitiveTwinSyncPayload', () => {
  it('removes client-only Twin fields before the onboarding record is persisted', () => {
    const payload = toCognitiveTwinSyncPayload({
      userId: 'user-1',
      updatedAt: '2026-08-08T12:00:00.000Z',
      version: 1,
      trustLevel: 'initial',
      isInitialized: true,
      onboardingCompletedAt: '2026-08-08T12:00:00.000Z',
      confidenceScore: 0,
      longTermGoal: 'Build a calm company',
      identity: { role: 'founder' },
      energyCurve: { chronotype: 'morning_lark' },
      metrics: { currentCognitiveLoad: 30 },
      bottlenecks: { mainFrictionPoint: 'context_switching' },
      workspaceLayout: { enabledModules: ['today'] },
    })

    expect(payload).toEqual({
      isInitialized: true,
      onboardingCompletedAt: '2026-08-08T12:00:00.000Z',
      confidenceScore: 0,
      longTermGoal: 'Build a calm company',
      identity: { role: 'founder' },
      energyCurve: { chronotype: 'morning_lark' },
      metrics: { currentCognitiveLoad: 30 },
      bottlenecks: { mainFrictionPoint: 'context_switching' },
      workspaceLayout: { enabledModules: ['today'] },
    })
  })
})
