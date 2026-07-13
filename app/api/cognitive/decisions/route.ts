import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ACTION_TYPE_LABEL } from '@/lib/cognitive-graph';

// Combined read-only feed over TwinEvolutionLog (what the twin inferred) and
// AiActionLog (what the AI actually did — created/edited/deleted a real
// record). This is what makes "AI-Native Ops" provable instead of asserted:
// a single timestamped trail spanning both inference and execution.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [twinLogs, actionLogs] = await Promise.all([
    prisma.twinEvolutionLog.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: { id: true, changeType: true, description: true, createdAt: true },
    }),
    prisma.aiActionLog.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: { id: true, actionType: true, success: true, triggeredBy: true, createdAt: true },
    }),
  ]);

  const combined = [
    ...twinLogs.map((l) => ({
      id: l.id,
      changeType: l.changeType,
      description: l.description,
      createdAt: l.createdAt,
    })),
    ...actionLogs.map((l) => ({
      id: l.id,
      changeType: 'ai_action',
      description: l.success
        ? `${ACTION_TYPE_LABEL[l.actionType] || l.actionType} (${l.triggeredBy === 'cron' ? 'automático' : 'IA'})`
        : `Falló: ${ACTION_TYPE_LABEL[l.actionType] || l.actionType}`,
      createdAt: l.createdAt,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 20);

  return NextResponse.json(combined);
}
