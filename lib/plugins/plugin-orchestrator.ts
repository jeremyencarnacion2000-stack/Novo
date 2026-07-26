/**
 * Plugin Orchestrator — runs all connected plugins in parallel and
 * synthesizes the results into a unified CognitiveTwinRecord update.
 *
 * Called by:
 *  - Inngest daily-insights function (daily background sync)
 *  - POST /api/plugins/[provider]/sync (on-demand per plugin)
 *  - POST /api/plugins/sync-all (on-demand full sync)
 */

import { syncNotionPlugin } from './notion-plugin';
import { syncTodoistPlugin } from './todoist-plugin';
import { syncSlackPlugin } from './slack-plugin';
import { syncGCalPlugin } from './gcal-plugin';
import { syncGitHubPlugin } from './github-plugin';
import { prisma } from '@/lib/prisma';

export type PluginProvider = 'notion' | 'todoist' | 'slack' | 'gcal' | 'github';

export interface PluginSyncSummary {
  provider: PluginProvider;
  status: 'success' | 'skipped' | 'error';
  signalsEmitted: number;
  summary: Record<string, any>;
  error?: string;
}

/**
 * Sync a single plugin by provider name.
 */
export async function syncPlugin(userId: string, provider: PluginProvider): Promise<PluginSyncSummary> {
  try {
    switch (provider) {
      case 'notion': {
        const r = await syncNotionPlugin(userId);
        return { provider, status: r.error === 'not_connected' ? 'skipped' : r.error ? 'error' : 'success', signalsEmitted: r.signalsEmitted, summary: r, error: r.error };
      }
      case 'todoist': {
        const r = await syncTodoistPlugin(userId);
        return { provider, status: r.error === 'not_connected' ? 'skipped' : r.error ? 'error' : 'success', signalsEmitted: r.signalsEmitted, summary: r, error: r.error };
      }
      case 'slack': {
        const r = await syncSlackPlugin(userId);
        return { provider, status: r.error === 'not_connected' ? 'skipped' : r.error ? 'error' : 'success', signalsEmitted: r.signalsEmitted, summary: r, error: r.error };
      }
      case 'gcal': {
        const r = await syncGCalPlugin(userId);
        return { provider, status: r.error === 'not_connected' ? 'skipped' : r.error ? 'error' : 'success', signalsEmitted: r.signalsEmitted, summary: r, error: r.error };
      }
      case 'github': {
        const r = await syncGitHubPlugin(userId);
        return { provider, status: r.error === 'not_connected' ? 'skipped' : r.error ? 'error' : 'success', signalsEmitted: r.signalsEmitted, summary: r, error: r.error };
      }
      default:
        return { provider, status: 'error', signalsEmitted: 0, summary: {}, error: `Unknown provider: ${provider}` };
    }
  } catch (err) {
    return { provider, status: 'error', signalsEmitted: 0, summary: {}, error: String(err) };
  }
}

/**
 * Sync ALL plugins for a user in parallel.
 * Returns a summary per provider and a final twin learning summary.
 */
export async function syncAllPlugins(userId: string): Promise<{
  results: PluginSyncSummary[];
  totalSignals: number;
  twinUpdated: boolean;
}> {
  const providers: PluginProvider[] = ['notion', 'todoist', 'slack', 'gcal', 'github'];

  const results = await Promise.all(providers.map((p) => syncPlugin(userId, p)));

  const totalSignals = results.reduce((sum, r) => sum + r.signalsEmitted, 0);

  // Synthesize chronotype from multiple plugin signals
  const twinUpdated = await synthesizeChronotype(userId, results);

  return { results, totalSignals, twinUpdated };
}

/**
 * Synthesize peak focus window from multiple plugin data sources.
 * Weighted average: GCal (50%) > Todoist completion (30%) > Notion editing (10%) > GitHub coding (10%)
 */
async function synthesizeChronotype(userId: string, results: PluginSyncSummary[]): Promise<boolean> {
  try {
    const twin = await prisma.cognitiveTwinRecord.findUnique({ where: { userId } });
    if (!twin) return false;

    const energyCurve = (twin.energyCurve as any) ?? {};

    // Collect available hour signals
    const signals: { hour: number; weight: number }[] = [];

    if (energyCurve.gcalDerivedAt && energyCurve.peakFocusStart) {
      const [h] = energyCurve.peakFocusStart.split(':').map(Number);
      signals.push({ hour: h, weight: 0.5 });
    }
    if (energyCurve.todoistPeakHour !== undefined) {
      signals.push({ hour: energyCurve.todoistPeakHour, weight: 0.3 });
    }
    if (energyCurve.notionPeakHour !== undefined) {
      signals.push({ hour: energyCurve.notionPeakHour, weight: 0.1 });
    }
    if (energyCurve.githubPeakCodingHour !== undefined) {
      signals.push({ hour: energyCurve.githubPeakCodingHour, weight: 0.1 });
    }

    if (signals.length < 2) return false;

    // Weighted average
    const totalWeight = signals.reduce((s, x) => s + x.weight, 0);
    const weightedHour = signals.reduce((s, x) => s + x.hour * x.weight, 0) / totalWeight;
    const synthesizedHour = Math.round(weightedHour);

    const chronotype = synthesizedHour < 10 ? 'morning_lark' : synthesizedHour > 14 ? 'night_owl' : 'intermediate';

    await prisma.cognitiveTwinRecord.update({
      where: { userId },
      data: {
        energyCurve: {
          ...energyCurve,
          synthesizedPeakHour: synthesizedHour,
          synthesizedChronotype: chronotype,
          lastSynthesizedAt: new Date().toISOString(),
        },
      },
    });

    return true;
  } catch {
    return false;
  }
}
