import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildCognitiveGraph } from '@/lib/cognitive-graph';
import { buildCognitiveGraphSnapshot } from '@/lib/cognitive-graph/projection';
import type { CognitiveLens } from '@/lib/cognitive-graph/types';

const lenses = new Set<CognitiveLens>(['now', 'goals', 'patterns', 'memory', 'sources']);

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const url = new URL(request.url);
  const requestedLens = url.searchParams.get('lens') as CognitiveLens | null;
  const lens: CognitiveLens = requestedLens && lenses.has(requestedLens) ? requestedLens : 'now';
  const focusNodeId = url.searchParams.get('focus') || undefined;
  const parsedDepth = Number(url.searchParams.get('depth') || '2');
  const depth = Number.isFinite(parsedDepth) ? Math.max(1, Math.min(parsedDepth, 3)) : 2;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
  if (user?.plan !== 'pro') {
    return NextResponse.json(
      { error: 'pro_required', message: 'El Cognitive Graph avanzado es una función Pro.' },
      { status: 403 }
    );
  }

  const [twinRecord, signalGroups, recentLogs] = await Promise.all([
    prisma.cognitiveTwinRecord.findUnique({
      where: { userId },
      select: { identity: true, energyCurve: true, metrics: true, bottlenecks: true },
    }),
    prisma.behavioralSignal.groupBy({
      by: ['signal'],
      where: { userId, occurredAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      _count: { signal: true },
    }),
    // Last 7 days of real inference events (written per-signal by
    // process-twin-signal.ts) — marks which nodes the twin just learned
    // something new about, so the graph visibly evolves over time.
    prisma.twinEvolutionLog.findMany({
      where: { userId, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      select: { changeType: true },
    }),
  ]);

  const signalCounts = signalGroups.map(g => ({ signal: g.signal, count: g._count.signal }));
  const graph = buildCognitiveGraph(twinRecord, signalCounts, recentLogs.map(l => l.changeType));
  const snapshot = await buildCognitiveGraphSnapshot({ userId, lens, focusNodeId, depth });

  // Keep the legacy graph shape for existing embeds while exposing the
  // bounded, evidence-backed snapshot to the new Cognitive Command Center.
  return NextResponse.json({ ...graph, snapshot });
}
