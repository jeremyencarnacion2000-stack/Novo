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
import { syncGmailPlugin } from './gmail-plugin';
import { prisma } from '@/lib/prisma';
import { hasGoogleScopes } from '@/lib/google-account';

export type PluginProvider = 'notion' | 'todoist' | 'slack' | 'gcal' | 'github' | 'gmail';

export interface PluginSyncSummary {
  provider: PluginProvider;
  status: 'success' | 'skipped' | 'error';
  signalsEmitted: number;
  summary: Record<string, any>;
  error?: 'not_connected' | 'scope_not_selected' | 'unavailable' | 'auth_failed' | 'reauthorization_required' | 'provider_error';
}

const ALL_PROVIDERS: PluginProvider[] = ['notion', 'todoist', 'slack', 'gcal', 'github', 'gmail'];
const BLOCKED_CONNECTION_STATES = new Set(['disconnected', 'revoked', 'reauth_required', 'error']);
const DEFAULT_PROVIDER_TIMEOUT_MS = 12_000;

export interface PluginSyncOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

function safePluginError(error: string | undefined): PluginSyncSummary['error'] {
  if (!error) return undefined;
  if (error === 'not_connected' || error === 'scope_not_selected'
    || error === 'unavailable' || error === 'auth_failed' || error === 'reauthorization_required') return error;
  return 'provider_error';
}

function summarizePluginResult<T extends { signalsEmitted: number; error?: string }>(
  provider: PluginProvider,
  result: T,
): PluginSyncSummary {
  const error = safePluginError(result.error);
  const { error: _providerError, ...safeSummary } = result;
  return {
    provider,
    status: error === 'not_connected' || error === 'scope_not_selected' ? 'skipped' : error ? 'error' : 'success',
    signalsEmitted: result.signalsEmitted,
    summary: safeSummary as Record<string, unknown>,
    ...(error ? { error } : {}),
  };
}

/**
 * Sync a single plugin by provider name.
 */
export async function syncPlugin(
  userId: string,
  provider: PluginProvider,
  options: PluginSyncOptions = {},
): Promise<PluginSyncSummary> {
  const controller = new AbortController();
  const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS);
  const abortFromParent = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abortFromParent();
  else options.signal?.addEventListener('abort', abortFromParent, { once: true });
  const timeout = setTimeout(() => controller.abort(new Error('provider_timeout')), timeoutMs);

  const aborted = new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener('abort', () => reject(new Error('provider_unavailable')), { once: true });
  });

  try {
    const execute = async (): Promise<PluginSyncSummary> => {
      switch (provider) {
      case 'notion': {
        const r = await syncNotionPlugin(userId, { signal: controller.signal });
        return summarizePluginResult(provider, r);
      }
      case 'todoist': {
        const r = await syncTodoistPlugin(userId, { signal: controller.signal });
        return summarizePluginResult(provider, r);
      }
      case 'slack': {
        const r = await syncSlackPlugin(userId, { signal: controller.signal });
        return summarizePluginResult(provider, r);
      }
      case 'gcal': {
        const r = await syncGCalPlugin(userId, { signal: controller.signal });
        return summarizePluginResult(provider, r);
      }
      case 'github': {
        const r = await syncGitHubPlugin(userId, { signal: controller.signal });
        return summarizePluginResult(provider, r);
      }
      case 'gmail': {
        const r = await syncGmailPlugin(userId, { signal: controller.signal });
        return summarizePluginResult(provider, r);
      }
      default:
        return { provider, status: 'error', signalsEmitted: 0, summary: {}, error: 'provider_error' };
      }
    };
    return await Promise.race([execute(), aborted]);
  } catch {
    return { provider, status: 'error', signalsEmitted: 0, summary: {}, error: controller.signal.aborted ? 'unavailable' : 'provider_error' };
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abortFromParent);
  }
}

async function connectedProviders(userId: string): Promise<Set<PluginProvider>> {
  const [integrationAccounts, googleAccounts] = await Promise.all([
    prisma.integrationAccount.findMany({
      where: { userId, provider: { in: ['notion', 'todoist', 'slack', 'github'] }, accessToken: { not: '' }, providerAccountId: { not: null } },
      select: { provider: true, syncStatus: true },
    }),
    prisma.account.findMany({
      where: { userId, provider: 'google', OR: [{ access_token: { not: null } }, { refresh_token: { not: null } }] },
      select: { scope: true },
    }),
  ]);

  const connected = new Set<PluginProvider>();
  for (const account of integrationAccounts) {
    if (!BLOCKED_CONNECTION_STATES.has(String(account.syncStatus ?? '').toLowerCase())) {
      connected.add(account.provider as PluginProvider);
    }
  }
  if (googleAccounts.some((account) => hasGoogleScopes(account.scope, ['calendar']))) connected.add('gcal');
  if (googleAccounts.some((account) => hasGoogleScopes(account.scope, ['gmail.readonly']))) connected.add('gmail');
  return connected;
}

/**
 * Sync ALL plugins for a user in parallel.
 * Returns a summary per provider and a final twin learning summary.
 */
export async function syncAllPlugins(userId: string, options: PluginSyncOptions = {}): Promise<{
  results: PluginSyncSummary[];
  totalSignals: number;
  twinUpdated: boolean;
}> {
  const connected = await connectedProviders(userId);
  const results = await Promise.all(ALL_PROVIDERS.map((provider) => connected.has(provider)
    ? syncPlugin(userId, provider, options)
    : Promise.resolve({
      provider,
      status: 'skipped' as const,
      signalsEmitted: 0,
      summary: {},
      error: 'not_connected' as const,
    })));

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
