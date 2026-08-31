/**
 * GitHub Plugin — reads commit activity via GitHub REST API.
 * Uses PAT stored in IntegrationAccount.metadata.token or accessToken.
 * Maps commit times → peak productivity window learning.
 * Maps weekend/late-night commits → burnout signal.
 */

import { prisma } from '@/lib/prisma';
import { getOrCreateTwin } from '@/lib/cognitive/get-or-create-twin';
import { upsertNovoSignals } from '@/lib/cognitive/signal-ledger';
import { fetchGitHubProviderIdentity } from '@/lib/github-provider-identity';

interface GitHubRepo {
  full_name: string;
  pushed_at: string;
  private: boolean;
}

interface GitHubCommit {
  sha: string;
  author?: { login?: string | null } | null;
  commit: {
    author: { name: string; email: string; date: string };
    message: string;
  };
}

interface GitHubSyncResult {
  reposChecked: number;
  commitsAnalyzed: number;
  lateNightCommits: number;
  weekendCommits: number;
  peakCodingHour?: number;
  signalsEmitted: number;
  error?: 'not_connected' | 'unavailable' | 'reauthorization_required';
}

async function fetchGitHubRepos(token: string, signal?: AbortSignal): Promise<GitHubRepo[]> {
  const res = await fetch('https://api.github.com/user/repos?sort=pushed&per_page=10', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
    signal,
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return res.json();
}

async function fetchRepoCommits(token: string, repoFullName: string, authorLogin: string, signal?: AbortSignal): Promise<GitHubCommit[]> {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const params = new URLSearchParams({ since, per_page: '30', author: authorLogin });
  const res = await fetch(
    `https://api.github.com/repos/${repoFullName}/commits?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
      signal,
    },
  );
  if (!res.ok) return [];
  return res.json();
}

export async function syncGitHubPlugin(userId: string, options: { signal?: AbortSignal } = {}): Promise<GitHubSyncResult> {
  try {
    const account = await prisma.integrationAccount.findUnique({
      where: { userId_provider: { userId, provider: 'github' } },
      select: { accessToken: true, metadata: true },
    });

    if (!account) {
      return { reposChecked: 0, commitsAnalyzed: 0, lateNightCommits: 0, weekendCommits: 0, signalsEmitted: 0, error: 'not_connected' };
    }
    const token = account.accessToken ?? (account.metadata as any)?.token;
    if (!token) {
      return { reposChecked: 0, commitsAnalyzed: 0, lateNightCommits: 0, weekendCommits: 0, signalsEmitted: 0, error: 'not_connected' };
    }

    const [ghUser, repos] = await Promise.all([
      fetchGitHubProviderIdentity(token, fetch, options.signal),
      fetchGitHubRepos(token, options.signal),
    ]);

    const allCommits: GitHubCommit[] = [];
    for (const repo of repos.slice(0, 5)) {
      // GitHub performs the identity filtering server-side. This is important
      // for users whose email is private or absent from the `/user` payload.
      const commits = await fetchRepoCommits(token, repo.full_name, ghUser.login, options.signal);
      allCommits.push(...commits);
    }

    const commitHours = allCommits.map((c) => new Date(c.commit.author.date).getHours());
    const commitDays = allCommits.map((c) => new Date(c.commit.author.date).getDay());

    // Late-night: before 6am or after 11pm
    const lateNight = commitHours.filter((h) => h < 6 || h > 23).length;
    // Weekends: 0=Sunday, 6=Saturday
    const weekends = commitDays.filter((d) => d === 0 || d === 6).length;

    // Peak coding hour
    const hourCounts: Record<number, number> = {};
    for (const h of commitHours) hourCounts[h] = (hourCounts[h] ?? 0) + 1;
    const peakCodingHour = commitHours.length > 0
      ? Number(Object.entries(hourCounts).sort(([, a], [, b]) => b - a)[0]?.[0])
      : undefined;

    // Burnout signal: >30% late-night commits OR >40% weekend commits
    const lateRatio = allCommits.length > 0 ? lateNight / allCommits.length : 0;
    const weekendRatio = allCommits.length > 0 ? weekends / allCommits.length : 0;
    const overworkDetected = (lateRatio > 0.3 || weekendRatio > 0.4) && allCommits.length >= 5;
    const githubBurnoutRiskScore = Math.min(
      100,
      Math.round(Math.max(lateRatio, weekendRatio) * 100),
    );

    const observedAt = new Date();
    await upsertNovoSignals(userId, [{
      source: 'github',
      sourceRef: 'coding-window',
      signalType: 'coding_activity_observed',
      label: `GitHub observed: ${allCommits.length} commits in 14 days, ${lateNight} late-night, ${weekends} weekend`,
      observedAt,
      reliability: 'direct',
    }]);

    const twin = await getOrCreateTwin(userId);
    const metrics = (twin.metrics as Record<string, unknown> | null) ?? {};
    await prisma.cognitiveTwinRecord.update({
      where: { userId },
      data: {
        metrics: {
          ...metrics,
          burnoutIndex: Math.max(Number(metrics.burnoutIndex ?? 0), githubBurnoutRiskScore),
          githubOverworkDetected: overworkDetected,
          githubBurnoutRiskScore,
          githubLateNightCommits14d: lateNight,
          githubWeekendCommits14d: weekends,
          githubCommitsObserved14d: allCommits.length,
        },
      },
    });

    // Update Twin with coding peak hour
    if (peakCodingHour !== undefined && commitHours.length >= 5) {
      const energyCurve = (twin.energyCurve as Record<string, unknown> | null) ?? {};
      await prisma.cognitiveTwinRecord.update({
        where: { userId },
        data: {
          energyCurve: {
            ...energyCurve,
            githubPeakCodingHour: peakCodingHour,
            githubDataPoints: commitHours.length,
          },
        },
      });
    }

    await prisma.integrationAccount.updateMany({
      where: { userId, provider: 'github' },
      data: {
        metadata: {
          ...((account.metadata && typeof account.metadata === 'object' && !Array.isArray(account.metadata)) ? account.metadata as Record<string, unknown> : {}),
          login: ghUser.login,
          avatarUrl: ghUser.avatarUrl,
          repoCount: repos.length,
        },
        lastSyncedAt: observedAt,
        lastSuccessfulSyncAt: observedAt,
        lastAttemptAt: observedAt,
        syncStatus: 'connected',
        syncErrorCode: null,
        syncErrorMessage: null,
      },
    });

    return {
      reposChecked: repos.length,
      commitsAnalyzed: allCommits.length,
      lateNightCommits: lateNight,
      weekendCommits: weekends,
      peakCodingHour,
      signalsEmitted: 1,
    };
  } catch (error) {
    console.error('[GitHubPlugin] Provider read failed');
    const reauthorizationRequired = error instanceof Error && error.message === 'github_reauthorization_required';
    await prisma.integrationAccount.updateMany({
      where: { userId, provider: 'github' },
      data: {
        lastAttemptAt: new Date(),
        ...(reauthorizationRequired
          ? { syncStatus: 'reauth_required', syncErrorCode: 'reauthorization_required', syncErrorMessage: null }
          : { syncErrorCode: 'provider_unavailable', syncErrorMessage: null }),
      },
    }).catch(() => undefined);
    return { reposChecked: 0, commitsAnalyzed: 0, lateNightCommits: 0, weekendCommits: 0, signalsEmitted: 0, error: reauthorizationRequired ? 'reauthorization_required' : 'unavailable' };
  }
}
