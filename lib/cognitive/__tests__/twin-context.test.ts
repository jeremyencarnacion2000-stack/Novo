/// <reference types="jest" />
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    cognitiveTwinRecord: { findUnique: jest.fn() },
    behavioralSignal: { groupBy: jest.fn() },
    twinEvolutionLog: { findMany: jest.fn() },
  },
}));

import { buildTwinContextSummary } from '../twin-context';

describe('buildTwinContextSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when the user has no CognitiveTwinRecord yet', async () => {
    (prisma.cognitiveTwinRecord.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.behavioralSignal.groupBy as jest.Mock).mockResolvedValue([]);
    (prisma.twinEvolutionLog.findMany as jest.Mock).mockResolvedValue([]);

    const result = await buildTwinContextSummary('user-1');
    expect(result).toBeNull();
  });

  it('returns the profile fields and a graph when a CognitiveTwinRecord exists', async () => {
    (prisma.cognitiveTwinRecord.findUnique as jest.Mock).mockResolvedValue({
      identity: { role: 'founder', industry: 'technology', focusStyle: 'deep_builder', deepWorkCapacity: 4.5 },
      energyCurve: { chronotype: 'night_owl', peakFocusStart: '20:00', peakFocusEnd: '23:00' },
      metrics: { currentCognitiveLoad: 35, decisionFatigueRisk: 'low', burnoutIndex: 15 },
      bottlenecks: { mainFrictionPoint: 'context_switching' },
      trustLevel: 'adapted',
      confidenceScore: 78,
    });
    (prisma.behavioralSignal.groupBy as jest.Mock).mockResolvedValue([
      { signal: 'task_completed', _count: { signal: 12 } },
    ]);
    (prisma.twinEvolutionLog.findMany as jest.Mock).mockResolvedValue([
      { changeType: 'trust_level_up' },
    ]);

    const result = await buildTwinContextSummary('user-1');

    expect(result).not.toBeNull();
    expect(result?.profile.trustLevel).toBe('adapted');
    expect(result?.profile.confidenceScore).toBe(78);
    expect(result?.profile.identity.role).toBe('founder');
    expect(result?.profile.energyCurve.chronotype).toBe('night_owl');
    expect(result?.profile.bottlenecks.mainFrictionPoint).toBe('context_switching');
    expect(result?.graph.nodes.length).toBeGreaterThan(0);
  });
});
