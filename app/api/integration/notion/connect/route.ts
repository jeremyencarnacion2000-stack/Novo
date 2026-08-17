/**
 * GET /api/integration/notion/connect
 *
 * Initiates the Notion OAuth 2.0 authorization flow.
 * Redirects the user to Notion's OAuth consent page.
 *
 * Required env vars:
 *   NOTION_CLIENT_ID       — your integration's OAuth client ID
 *   NOTION_REDIRECT_URI    — must match exactly what's registered in Notion (e.g. https://yourapp.com/api/integration/notion/callback)
 *   NEXTAUTH_URL           — base URL (used as fallback for redirect)
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

    const clientId = process.env.NOTION_CLIENT_ID;
    const redirectUri = process.env.NOTION_REDIRECT_URI;

    if (!clientId || !redirectUri) {
        const url = new URL('/connectors', request.url);
        url.searchParams.set('integrationStatus', 'unconfigured');
        url.searchParams.set('provider', 'notion');
        return NextResponse.redirect(url);
    }

    const state = createIntegrationOAuthState(session.user.id, 'notion');
    const payload = parseIntegrationOAuthState(state, 'notion');
    if (!payload) return NextResponse.json({ error: 'Unable to create OAuth state' }, { status: 503 });

    await prisma.todoistOAuthState.create({
        data: {
            provider: 'notion',
            userId: session.user.id,
            nonceHash: hashOAuthNonce(payload.nonce),
            expiresAt: new Date(payload.issuedAt + INTEGRATION_OAUTH_STATE_TTL_MS),
        },
    });

    const cookieStore = await cookies();
    cookieStore.set('novo_notion_oauth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: INTEGRATION_OAUTH_STATE_TTL_MS / 1000,
        path: '/',
    });

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        owner: 'user', // Request user-level access (not workspace-level)
        state,
    });

    const notionOAuthUrl = `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;

    return NextResponse.redirect(notionOAuthUrl);
}
