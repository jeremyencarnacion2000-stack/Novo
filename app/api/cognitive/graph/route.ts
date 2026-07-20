import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildCognitiveGraph } from '@/lib/cognitive-graph';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

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

  return NextResponse.json(graph);
}
