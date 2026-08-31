/**
 * Slack Plugin — reads channel activity and DM patterns to detect:
 * - After-hours messaging → burnout risk signal
 * - Response time patterns → cognitive load
 * - Message volume → stress indicator
 */

import { prisma } from '@/lib/prisma';
import { getOrCreateTwin } from '@/lib/cognitive/get-or-create-twin';
import { upsertNovoSignals } from '@/lib/cognitive/signal-ledger';

interface SlackMessage {
  ts: string;
  text: string;
  user?: string;
  type: string;
}

interface SlackChannel {
  id: string;
  name: string;
  is_member: boolean;
}

interface SlackSyncResult {
  messagesAnalyzed: number;
  afterHoursMessages: number;
  averageResponseMinutes?: number;
  signalsEmitted: number;
  burnoutRiskDetected: boolean;
  error?: string;
}

async function fetchSlackChannels(token: string, signal?: AbortSignal): Promise<SlackChannel[]> {
  const res = await fetch('https://slack.com/api/conversations.list?limit=20&types=public_channel,private_channel', {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  const data = await res.json();
  if (!data.ok) return [];
  return (data.channels ?? []).filter((c: SlackChannel) => c.is_member);
}

async function fetchChannelHistory(token: string, channelId: string, signal?: AbortSignal): Promise<SlackMessage[]> {
  const oldest = String(Math.floor((Date.now() - 48 * 60 * 60 * 1000) / 1000));
  const res = await fetch(
    `https://slack.com/api/conversations.history?channel=${channelId}&oldest=${oldest}&limit=100`,
    { headers: { Authorization: `Bearer ${token}` }, signal },
  );
  const data = await res.json();
  if (!data.ok) return [];
  return data.messages ?? [];
}

async function fetchSlackUserId(token: string, signal?: AbortSignal): Promise<string | null> {
  const res = await fetch('https://slack.com/api/auth.test', {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  const data = await res.json();
  return data.ok ? data.user_id : null;
}

export async function syncSlackPlugin(userId: string, options: { signal?: AbortSignal } = {}): Promise<SlackSyncResult> {
  try {
    const account = await prisma.integrationAccount.findUnique({
      where: { userId_provider: { userId, provider: 'slack' } },
      select: { accessToken: true, metadata: true },
    });

    if (!account?.accessToken) {
      return { messagesAnalyzed: 0, afterHoursMessages: 0, signalsEmitted: 0, burnoutRiskDetected: false, error: 'not_connected' };
    }

    const [slackUserId, channels] = await Promise.all([
      fetchSlackUserId(account.accessToken, options.signal),
      fetchSlackChannels(account.accessToken, options.signal),
    ]);

    if (!slackUserId) {
      return { messagesAnalyzed: 0, afterHoursMessages: 0, signalsEmitted: 0, burnoutRiskDetected: false, error: 'auth_failed' };
    }

    // Fetch history from top 5 channels
    const topChannels = channels.slice(0, 5);
    const allMessages = (
      await Promise.all(
        topChannels.map((channel) => fetchChannelHistory(account.accessToken, channel.id, options.signal))
      )
    ).flat();

    // Filter to messages sent BY this user
    const myMessages = allMessages.filter((m) => m.user === slackUserId && m.type === 'message');

    // Detect after-hours messages (before 8am or after 9pm)
    const afterHours = myMessages.filter((m) => {
      const h = new Date(Number(m.ts) * 1000).getHours();
      return h < 8 || h > 21;
    });

    const afterHoursRatio = myMessages.length > 0 ? afterHours.length / myMessages.length : 0;
    const burnoutRiskDetected = afterHoursRatio > 0.3 || afterHours.length > 10;

    // Calculate message volume → cognitive load signal
    const last24hMessages = myMessages.filter(
      (m) => Number(m.ts) * 1000 > Date.now() - 24 * 60 * 60 * 1000,
    );
    const slackBurnoutRiskScore = Math.min(
      100,
      Math.round(Math.max(afterHoursRatio * 100, afterHours.length * 6)),
    );
    const slackCognitiveLoadEstimate = Math.min(
      100,
      Math.round((last24hMessages.length / 40) * 75),
    );

    // A provider poll is a replaceable snapshot, not a new human action. The
    // stable sourceRef keeps overlapping 48h windows on one durable ledger row.
    await upsertNovoSignals(userId, [{
      source: 'slack',
      sourceRef: 'activity-window',
      signalType: 'activity_observed',
      label: `Slack activity observed: ${myMessages.length} messages in 48h, ${afterHours.length} after hours, ${last24hMessages.length} in 24h`,
      observedAt: new Date(),
      reliability: 'direct',
    }]);

    const twin = await getOrCreateTwin(userId);
    const metrics = (twin.metrics as Record<string, unknown> | null) ?? {};
    await prisma.cognitiveTwinRecord.update({
      where: { userId },
      data: {
        metrics: {
          ...metrics,
          burnoutIndex: Math.max(Number(metrics.burnoutIndex ?? 0), slackBurnoutRiskScore),
          currentCognitiveLoad: Math.max(Number(metrics.currentCognitiveLoad ?? 0), slackCognitiveLoadEstimate),
          slackAfterHoursDetected: burnoutRiskDetected,
          slackBurnoutRiskScore,
          slackCognitiveLoadEstimate,
          slackAfterHoursMessages: afterHours.length,
          slackMessagesObserved48h: myMessages.length,
          slackMessageVolume24h: last24hMessages.length,
        },
      },
    });

    return {
      messagesAnalyzed: myMessages.length,
      afterHoursMessages: afterHours.length,
      signalsEmitted: 1,
      burnoutRiskDetected,
    };
  } catch {
    console.error('[SlackPlugin] Provider read failed');
    return { messagesAnalyzed: 0, afterHoursMessages: 0, signalsEmitted: 0, burnoutRiskDetected: false, error: 'unavailable' };
  }
}
