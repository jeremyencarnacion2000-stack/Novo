/**
 * GitHub Plugin — reads commit activity via GitHub REST API.
 * Uses PAT stored in IntegrationAccount.metadata.token or accessToken.
 * Maps commit times → peak productivity window learning.
 * Maps weekend/late-night commits → burnout signal.
 */

import { prisma } from '@/lib/prisma';
import { getOrCreateTwin } from '@/lib/cognitive/get-or-create-twin';

interface GitHubRepo {
  full_name: string;
  pushed_at: string;
  private: boolean;
}

interface GitHubCommit {
  sha: string;
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
  error?: string;
}

async function fetchGitHubRepos(token: string): Promise<GitHubRepo[]> {
  const res = await fetch('https://api.github.com/user/repos?sort=pushed&per_page=10', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return res.json();
}

async function fetchRepoCommits(token: string, repoFullName: string, authorEmail: string): Promise<GitHubCommit[]> {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const res = await fetch(
    `https://api.github.com/repos/${repoFullName}/commits?since=${since}&per_page=30`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    },
  );
  if (!res.ok) return [];
  return res.json();
}

async function fetchGitHubUser(token: string): Promise<{ email: string; login: string } | null> {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function syncGitHubPlugin(userId: string): Promise<GitHubSyncResult> {
  try {
    const account = await prisma.integrationAccount.findUnique({
      where: { userId_provider: { userId, provider: 'github' } },
      select: { accessToken: true, metadata: true },
    });

    const token = account?.accessToken ?? (account?.metadata as any)?.token;
    if (!token) {
      return { reposChecked: 0, commitsAnalyzed: 0, lateNightCommits: 0, weekendCommits: 0, signalsEmitted: 0, error: 'not_connected' };
    }

    const [ghUser, repos] = await Promise.all([
      fetchGitHubUser(token),
      fetchGitHubRepos(token),
    ]);

    if (!ghUser) {
      return { reposChecked: 0, commitsAnalyzed: 0, lateNightCommits: 0, weekendCommits: 0, signalsEmitted: 0, error: 'auth_failed' };
    }

    const allCommits: GitHubCommit[] = [];
    for (const repo of repos.slice(0, 5)) {
      const commits = await fetchRepoCommits(token, repo.full_name, ghUser.email);
      // Filter to commits by this user
      const mine = commits.filter(
        (c) => c.commit.author.email === ghUser.email || c.commit.author.name === ghUser.login,
      );
      allCommits.push(...mine);
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

    let signalsEmitted = 0;

    // Burnout signal: >30% late-night commits OR >40% weekend commits
    const lateRatio = allCommits.length > 0 ? lateNight / allCommits.length : 0;
    const weekendRatio = allCommits.length > 0 ? weekends / allCommits.length : 0;

    if ((lateRatio > 0.3 || weekendRatio > 0.4) && allCommits.length >= 5) {
      const twin = await getOrCreateTwin(userId);
      await prisma.behavioralSignal.create({
        data: {
          userId,
          twinId: twin.id,
          signal: 'task_deferred',
          occurredAt: new Date(),
          metadata: {
            source: 'github',
            type: 'overwork_pattern',
            lateNightCommits: lateNight,
            weekendCommits: weekends,
            totalCommits: allCommits.length,
            lateRatio: lateRatio.toFixed(2),
            weekendRatio: weekendRatio.toFixed(2),
          },
        },
      });

      // Boost burnout index
      if (twin) {
        const metrics = (twin.metrics as any) ?? {};
        await prisma.cognitiveTwinRecord.update({
          where: { userId },
          data: {
            metrics: {
              ...metrics,
              burnoutIndex: Math.min(100, (metrics.burnoutIndex ?? 0) + lateNight * 3),
              githubOverworkDetected: true,
            },
          },
        });
      }
      signalsEmitted++;
    }

    // Update Twin with coding peak hour
    if (peakCodingHour !== undefined && commitHours.length >= 5) {
      const twin = await prisma.cognitiveTwinRecord.findUnique({ where: { userId } });
      if (twin) {
        const energyCurve = (twin.energyCurve as any) ?? {};
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
    }

    return {
      reposChecked: repos.length,
      commitsAnalyzed: allCommits.length,
      lateNightCommits: lateNight,
      weekendCommits: weekends,
      peakCodingHour,
      signalsEmitted,
    };
  } catch (err) {
    console.error('[GitHubPlugin] Error:', err);
    return { reposChecked: 0, commitsAnalyzed: 0, lateNightCommits: 0, weekendCommits: 0, signalsEmitted: 0, error: String(err) };
  }
}
