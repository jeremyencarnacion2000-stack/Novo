import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { runTwinAgent } from '@/lib/cognitive/twin-agent';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = await runTwinAgent(session.user.id);

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: results.length,
        acted: results.filter((r) => r.result === 'success').length,
        skipped: results.filter((r) => r.result === 'skipped').length,
        failed: results.filter((r) => r.result === 'failed').length,
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

    const { prisma } = await import('@/lib/prisma');

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

    return NextResponse.json({ logs: recentLogs });
  } catch (err) {
    console.error('[twin-agent/logs] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
