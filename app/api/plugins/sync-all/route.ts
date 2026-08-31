/**
 * POST /api/plugins/sync-all
 * Triggers a full sync of all connected plugins in parallel.
 * Called by the daily Inngest cron and by the UI "Sync All" button.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { syncAllPlugins } from '@/lib/plugins/plugin-orchestrator';
import { runAmbientTwinForUser } from '@/lib/cognitive/ambient-twin-runtime';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { results, totalSignals, twinUpdated } = await syncAllPlugins(session.user.id);
    const ambient = await runAmbientTwinForUser(session.user.id, { trigger: 'sync' });
    return NextResponse.json({
      success: true,
      totalSignals,
      twinUpdated,
      planning: ambient.planning,
      recommendation: ambient.recommendation ? {
        id: ambient.recommendation.id,
        title: ambient.recommendation.title,
        nextStep: ambient.recommendation.nextStep,
        confidence: ambient.recommendation.confidence,
      } : null,
      results: results.map((r) => ({
        provider: r.provider,
        status: r.status,
        signalsEmitted: r.signalsEmitted,
        error: r.error,
      })),
    });
  } catch {
    return NextResponse.json({ error: 'plugin_sync_failed' }, { status: 500 });
  }
}
