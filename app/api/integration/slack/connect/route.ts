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
import { createIntegrationOAuthState, hashOAuthNonce, INTEGRATION_OAUTH_STATE_TTL_MS, parseIntegrationOAuthState } from '@/lib/todoist-oauth-state';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientId = process.env.SLACK_CLIENT_ID;
    const redirectUri = process.env.SLACK_REDIRECT_URI;

    if (!clientId || !redirectUri) {
        const url = new URL('/connectors', request.url);
        url.searchParams.set('integrationStatus', 'unconfigured');
        url.searchParams.set('provider', 'slack');
        return NextResponse.redirect(url);
    }

    const state = createIntegrationOAuthState(session.user.id, 'slack');
    const payload = parseIntegrationOAuthState(state, 'slack');
    if (!payload) return NextResponse.json({ error: 'Unable to create OAuth state' }, { status: 503 });

    await prisma.todoistOAuthState.create({
        data: {
            provider: 'slack',
            userId: session.user.id,
            nonceHash: hashOAuthNonce(payload.nonce),
            expiresAt: new Date(payload.issuedAt + INTEGRATION_OAUTH_STATE_TTL_MS),
        },
    });

    const cookieStore = await cookies();
    cookieStore.set('novo_slack_oauth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: INTEGRATION_OAUTH_STATE_TTL_MS / 1000,
        path: '/',
    });

    const params = new URLSearchParams({
        client_id: clientId,
        scope: 'chat:write,channels:read,groups:read',
        redirect_uri: redirectUri,
        state,
    });

    return NextResponse.redirect(`https://slack.com/oauth/v2/authorize?${params.toString()}`);
}
