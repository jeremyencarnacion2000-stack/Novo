/**
 * POST /api/plugins/[provider]/sync
 * GET  /api/plugins/[provider]/sync  — last sync summary
 *
 * Triggers an on-demand sync for a specific integration plugin.
 * Also used by the chat "+" connector panel to force a refresh.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { syncPlugin, type PluginProvider } from '@/lib/plugins/plugin-orchestrator';
import { runAmbientTwinForUser } from '@/lib/cognitive/ambient-twin-runtime';

const VALID_PROVIDERS: PluginProvider[] = ['notion', 'todoist', 'slack', 'gcal', 'github'];

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ provider: string }> },
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const provider = params.provider as PluginProvider;
  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
  }

  try {
    const result = await syncPlugin(session.user.id, provider);
    await runAmbientTwinForUser(session.user.id, { trigger: 'sync' });
    return NextResponse.json({ success: true, result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ provider: string }> },
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { prisma } = await import('@/lib/prisma');

  // Return recent agent logs tagged to this provider as a proxy for "last sync"
  const logs = await prisma.twinAgentLog.findMany({
    where: {
      userId: session.user.id,
      metadata: { path: ['source'], equals: params.provider },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { capability: true, description: true, result: true, createdAt: true, metadata: true },
  });

  return NextResponse.json({ provider: params.provider, recentActions: logs });
}
