import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { runTwinAgent } from '@/lib/cognitive/twin-agent';
import { prisma } from '@/lib/prisma';
import { parsePersistedTwinAdaptationProposals } from '@/lib/cognitive/twin-adaptation';
import { runAmbientTwinForUser } from '@/lib/cognitive/ambient-twin-runtime';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [results, twin] = await Promise.all([
      runTwinAgent(session.user.id),
      prisma.cognitiveTwinRecord.findUnique({ where: { userId: session.user.id }, select: { identity: true, confidenceScore: true, trustLevel: true } }),
    ]);
    const proposals = parsePersistedTwinAdaptationProposals(twin?.identity);
    void runAmbientTwinForUser(session.user.id, { trigger: 'agent_outcome' }).catch(() => undefined);

    return NextResponse.json({
      success: true,
      results,
      proposals,
      executionMode: 'proposal_only',
      confirmationRequired: true,
      twin: twin ? { confidenceScore: twin.confidenceScore, trustLevel: twin.trustLevel } : null,
      summary: {
        total: results.length,
        acted: results.filter((r) => r.result === 'success').length,
        skipped: results.filter((r) => r.result === 'skipped').length,
        failed: results.filter((r) => r.result === 'failed').length,
        proposals: proposals.length,
      },
    });
  } catch (err) {
    console.error('[twin-agent/run] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const recentLogs = await prisma.twinAgentLog.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        capability: true,
        trigger: true,
        description: true,
        result: true,
        metadata: true,
        createdAt: true,
      },
    });

    const twin = await prisma.cognitiveTwinRecord.findUnique({ where: { userId: session.user.id }, select: { identity: true, confidenceScore: true, trustLevel: true } });
    return NextResponse.json({
      logs: recentLogs,
      proposals: parsePersistedTwinAdaptationProposals(twin?.identity),
      executionMode: 'proposal_only',
      confirmationRequired: true,
      twin: twin ? { confidenceScore: twin.confidenceScore, trustLevel: twin.trustLevel } : null,
    });
  } catch (err) {
    console.error('[twin-agent/logs] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
