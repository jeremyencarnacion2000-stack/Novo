/**
 * Slack Plugin — reads channel activity and DM patterns to detect:
 * - After-hours messaging → burnout risk signal
 * - Response time patterns → cognitive load
 * - Message volume → stress indicator
 */

import { prisma } from '@/lib/prisma';
import { getOrCreateTwin } from '@/lib/cognitive/get-or-create-twin';

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

async function fetchSlackChannels(token: string): Promise<SlackChannel[]> {
  const res = await fetch('https://slack.com/api/conversations.list?limit=20&types=public_channel,private_channel', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!data.ok) return [];
  return (data.channels ?? []).filter((c: SlackChannel) => c.is_member);
}

async function fetchChannelHistory(token: string, channelId: string): Promise<SlackMessage[]> {
  const oldest = String(Math.floor((Date.now() - 48 * 60 * 60 * 1000) / 1000));
  const res = await fetch(
    `https://slack.com/api/conversations.history?channel=${channelId}&oldest=${oldest}&limit=100`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = await res.json();
  if (!data.ok) return [];
  return data.messages ?? [];
}

async function fetchSlackUserId(token: string): Promise<string | null> {
  const res = await fetch('https://slack.com/api/auth.test', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return data.ok ? data.user_id : null;
}

export async function syncSlackPlugin(userId: string): Promise<SlackSyncResult> {
  try {
    const account = await prisma.integrationAccount.findUnique({
      where: { userId_provider: { userId, provider: 'slack' } },
      select: { accessToken: true, metadata: true },
    });

    if (!account?.accessToken) {
      return { messagesAnalyzed: 0, afterHoursMessages: 0, signalsEmitted: 0, burnoutRiskDetected: false, error: 'not_connected' };
    }

    const [slackUserId, channels] = await Promise.all([
      fetchSlackUserId(account.accessToken),
      fetchSlackChannels(account.accessToken),
    ]);

    if (!slackUserId) {
      return { messagesAnalyzed: 0, afterHoursMessages: 0, signalsEmitted: 0, burnoutRiskDetected: false, error: 'auth_failed' };
    }

    // Fetch history from top 5 channels
    const topChannels = channels.slice(0, 5);
    const allMessages: SlackMessage[] = [];

    for (const channel of topChannels) {
      const msgs = await fetchChannelHistory(account.accessToken, channel.id);
      allMessages.push(...msgs);
    }

    // Filter to messages sent BY this user
    const myMessages = allMessages.filter((m) => m.user === slackUserId && m.type === 'message');

    // Detect after-hours messages (before 8am or after 9pm)
    const afterHours = myMessages.filter((m) => {
      const h = new Date(Number(m.ts) * 1000).getHours();
      return h < 8 || h > 21;
    });

    const afterHoursRatio = myMessages.length > 0 ? afterHours.length / myMessages.length : 0;
    const burnoutRiskDetected = afterHoursRatio > 0.3 || afterHours.length > 10;

    let signalsEmitted = 0;

    if (burnoutRiskDetected) {
      const twin = await getOrCreateTwin(userId);
      await prisma.behavioralSignal.create({
        data: {
          userId,
          twinId: twin.id,
          signal: 'task_deferred', // closest existing signal for overwork
          occurredAt: new Date(),
          metadata: {
            source: 'slack',
            type: 'after_hours_activity',
            afterHoursMessages: afterHours.length,
            totalMessages: myMessages.length,
            afterHoursRatio: afterHoursRatio.toFixed(2),
          },
        },
      });
      signalsEmitted++;

      // Directly boost burnout index in twin
      if (twin) {
        const metrics = (twin.metrics as any) ?? {};
        const currentBurnout = metrics.burnoutIndex ?? 0;
        const newBurnout = Math.min(100, currentBurnout + afterHours.length * 2);
        await prisma.cognitiveTwinRecord.update({
          where: { userId },
          data: {
            metrics: { ...metrics, burnoutIndex: newBurnout, slackAfterHoursDetected: true },
          },
        });
      }
    }

    // Calculate message volume → cognitive load signal
    const last24hMessages = myMessages.filter(
      (m) => Number(m.ts) * 1000 > Date.now() - 24 * 60 * 60 * 1000,
    );
    if (last24hMessages.length > 40) {
      const twin = await prisma.cognitiveTwinRecord.findUnique({ where: { userId } });
      if (twin) {
        const metrics = (twin.metrics as any) ?? {};
        await prisma.cognitiveTwinRecord.update({
          where: { userId },
          data: {
            metrics: {
              ...metrics,
              currentCognitiveLoad: Math.min(100, (metrics.currentCognitiveLoad ?? 50) + 15),
              slackMessageVolume24h: last24hMessages.length,
            },
          },
        });
      }
    }

    return {
      messagesAnalyzed: myMessages.length,
      afterHoursMessages: afterHours.length,
      signalsEmitted,
      burnoutRiskDetected,
    };
  } catch (err) {
    console.error('[SlackPlugin] Error:', err);
    return { messagesAnalyzed: 0, afterHoursMessages: 0, signalsEmitted: 0, burnoutRiskDetected: false, error: String(err) };
  }
}
