// Full Cognitive Twin profile + graph, for chat's "Modo Twin". Reuses the
// exact fetch pattern already proven in app/api/cognitive/graph/route.ts —
// this is a superset of that route's data (adds trustLevel/confidenceScore,
// needed for the chat context but not for the visual graph).

import { prisma } from '@/lib/prisma';
import { buildCognitiveGraph, type CognitiveGraph } from '@/lib/cognitive-graph';

export interface TwinProfile {
  identity: { role?: string; industry?: string; focusStyle?: string; deepWorkCapacity?: number };
  energyCurve: { chronotype?: string; peakFocusStart?: string; peakFocusEnd?: string };
  metrics: { currentCognitiveLoad?: number; decisionFatigueRisk?: string; burnoutIndex?: number };
  bottlenecks: { mainFrictionPoint?: string };
  trustLevel: string;
  confidenceScore: number;
}

export interface TwinContextSummary {
  profile: TwinProfile;
  graph: CognitiveGraph;
}

export async function buildTwinContextSummary(userId: string): Promise<TwinContextSummary | null> {
  const [twinRecord, signalGroups, recentLogs] = await Promise.all([
    prisma.cognitiveTwinRecord.findUnique({
      where: { userId },
      select: {
        identity: true,
        energyCurve: true,
        metrics: true,
        bottlenecks: true,
        trustLevel: true,
        confidenceScore: true,
      },
    }),
    prisma.behavioralSignal.groupBy({
      by: ['signal'],
      where: { userId, occurredAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      _count: { signal: true },
    }),
    prisma.twinEvolutionLog.findMany({
      where: { userId, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      select: { changeType: true },
    }),
  ]);

  if (!twinRecord) return null;

  const signalCounts = signalGroups.map(g => ({ signal: g.signal, count: g._count.signal }));
  const graph = buildCognitiveGraph(twinRecord, signalCounts, recentLogs.map(l => l.changeType));

  return {
    profile: {
      identity: (twinRecord.identity as TwinProfile['identity']) || {},
      energyCurve: (twinRecord.energyCurve as TwinProfile['energyCurve']) || {},
      metrics: (twinRecord.metrics as TwinProfile['metrics']) || {},
      bottlenecks: (twinRecord.bottlenecks as TwinProfile['bottlenecks']) || {},
      trustLevel: twinRecord.trustLevel,
      confidenceScore: twinRecord.confidenceScore,
    },
    graph,
  };
}
