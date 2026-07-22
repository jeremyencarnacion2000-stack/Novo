/**
 * Slack Web API service layer.
 *
 * Slack's role in Novo is the reverse of Notion/Todoist: it's an OUTPUT
 * channel, not a task source. The cognitive engine pushes signals into a
 * chosen Slack channel instead of Novo pulling tasks out of Slack.
 *
 * OAuth v2 (bot token, not user token) — access tokens come from
 * IntegrationAccount records. Server-only; never import in client components.
 */

const API_BASE = 'https://slack.com/api';

function authHeaders(accessToken: string) {
    return {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=utf-8',
    };
}

export const slackService = {
    /** Lists channels the bot can see, for the channel picker UI. */
    listChannels: async (accessToken: string): Promise<{ id: string; title: string }[]> => {
        const res = await fetch(`${API_BASE}/conversations.list?types=public_channel,private_channel&limit=200`, {
            headers: authHeaders(accessToken),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(`Slack listChannels failed: ${data.error}`);
        return (data.channels as any[]).map(c => ({ id: c.id, title: `#${c.name}` }));
    },

    /** Posts a message to a channel. Used both for the "test message" action and real cognitive-engine alerts. */
    postMessage: async (accessToken: string, channelId: string, text: string): Promise<void> => {
        const res = await fetch(`${API_BASE}/chat.postMessage`, {
            method: 'POST',
            headers: authHeaders(accessToken),
            body: JSON.stringify({ channel: channelId, text }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(`Slack postMessage failed: ${data.error}`);
    },
};
