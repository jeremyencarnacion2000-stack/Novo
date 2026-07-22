/**
 * GET /api/integration/slack/connect
 *
 * Initiates the Slack OAuth v2 ("Add to Slack") flow. Requests a bot token
 * (not a user token) with just enough scope to list channels and post
 * messages — Slack's role in Novo is delivering cognitive-engine alerts,
 * nothing more.
 *
 * Required env vars:
 *   SLACK_CLIENT_ID
 *   SLACK_CLIENT_SECRET
 *   SLACK_REDIRECT_URI  — must match exactly what's registered for the app (e.g. https://yourapp.com/api/integration/slack/callback)
 */

import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientId = process.env.SLACK_CLIENT_ID;
    const redirectUri = process.env.SLACK_REDIRECT_URI;

    if (!clientId || !redirectUri) {
        return NextResponse.json(
            { error: 'Slack integration is not configured. Set SLACK_CLIENT_ID and SLACK_REDIRECT_URI.' },
            { status: 503 },
        );
    }

    const params = new URLSearchParams({
        client_id: clientId,
        scope: 'chat:write,channels:read,groups:read',
        redirect_uri: redirectUri,
        state: session.user.id,
    });

    return NextResponse.redirect(`https://slack.com/oauth/v2/authorize?${params.toString()}`);
}
