/**
 * GET /api/integration/slack/callback
 *
 * Receives the OAuth `code` from Slack after workspace authorization,
 * exchanges it for a bot access token, and upserts an IntegrationAccount
 * record for this user.
 *
 * Redirects to /?slackStatus= so the UI can display a success/error toast.
 */

import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { hashOAuthNonce, parseIntegrationOAuthState } from '@/lib/todoist-oauth-state';

export async function GET(req: NextRequest) {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const settingsUrl = `${baseUrl}/?slackStatus=`;

    // ── 1. Auth guard ──────────────────────────────────────────────────────────
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.redirect(`${settingsUrl}error&reason=unauthenticated`);
    }

    // ── 2. Validate OAuth code and state ───────────────────────────────────────
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    const cookieStore = await cookies();
    const storedState = cookieStore.get('novo_slack_oauth_state')?.value;
    cookieStore.delete('novo_slack_oauth_state');
    const payload = parseIntegrationOAuthState(state, 'slack');
    if (!storedState || state !== storedState || !payload || payload.userId !== session.user.id) {
        return NextResponse.redirect(`${settingsUrl}error&reason=invalid_state`);
    }

    const claimed = await prisma.todoistOAuthState.updateMany({
        where: {
            provider: 'slack',
            userId: session.user.id,
            nonceHash: hashOAuthNonce(payload.nonce),
            status: 'issued',
            consumedAt: null,
            expiresAt: { gt: new Date() },
        },
        data: { status: 'consumed', consumedAt: new Date() },
    });
    if (claimed.count !== 1) return NextResponse.redirect(`${settingsUrl}error&reason=invalid_state`);

    if (error || !code) {
        console.error('[Slack Callback] OAuth denied or missing code:', { reason: error ? error.slice(0, 80) : 'missing_code' });
        return NextResponse.redirect(`${settingsUrl}error&reason=denied`);
    }

    // ── 3. Exchange code for a bot access token ────────────────────────────────
    const clientId = process.env.SLACK_CLIENT_ID!;
    const clientSecret = process.env.SLACK_CLIENT_SECRET!;
    const redirectUri = process.env.SLACK_REDIRECT_URI!;

    let tokenData: any;
    try {
        const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                code,
                redirect_uri: redirectUri,
            }),
        });

        tokenData = await tokenRes.json();
        if (!tokenRes.ok || !tokenData.ok || !tokenData.access_token) {
            console.error('[Slack Callback] Token exchange failed:', {
                status: tokenRes.status,
                ok: Boolean(tokenData?.ok),
                error: typeof tokenData?.error === 'string' ? tokenData.error.slice(0, 80) : undefined,
            });
            return NextResponse.redirect(`${settingsUrl}error&reason=token_exchange`);
        }
    } catch (err) {
        console.error('[Slack Callback] Network error during token exchange:', { name: err instanceof Error ? err.name : 'UnknownError' });
        return NextResponse.redirect(`${settingsUrl}error&reason=network`);
    }

    // ── 4. Upsert IntegrationAccount ───────────────────────────────────────────
    // tokenData shape: { access_token, team: { id, name }, bot_user_id, ... }
    try {
        const existing = await prisma.integrationAccount.findUnique({
            where: { userId_provider: { userId: session.user.id, provider: 'slack' } },
            select: { metadata: true },
        });
        const existingMeta = (existing?.metadata as any) ?? {};

        await prisma.integrationAccount.upsert({
            where: {
                userId_provider: {
                    userId: session.user.id,
                    provider: 'slack',
                },
            },
            create: {
                userId: session.user.id,
                provider: 'slack',
                accessToken: tokenData.access_token,
                tokenType: 'Bearer',
                metadata: {
                    teamId: tokenData.team?.id ?? null,
                    teamName: tokenData.team?.name ?? null,
                    // No channel selected yet — user picks it from settings UI
                    channelId: null,
                    channelName: null,
                },
            },
            update: {
                accessToken: tokenData.access_token,
                tokenType: 'Bearer',
                metadata: {
                    ...existingMeta,
                    teamId: tokenData.team?.id ?? null,
                    teamName: tokenData.team?.name ?? null,
                    channelId: existingMeta.channelId ?? null,
                    channelName: existingMeta.channelName ?? null,
                },
                updatedAt: new Date(),
            },
        });

        console.log(`✅ [Slack] Connected for user ${session.user.id}, team: ${tokenData.team?.name}`);
    } catch (err) {
        console.error('[Slack Callback] Failed to upsert IntegrationAccount:', { name: err instanceof Error ? err.name : 'UnknownError' });
        return NextResponse.redirect(`${settingsUrl}error&reason=db_write`);
    }

    // ── 5. Redirect back to settings ───────────────────────────────────────────
    return NextResponse.redirect(`${settingsUrl}connected`);
}
