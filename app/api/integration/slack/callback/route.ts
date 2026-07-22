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

export async function GET(req: NextRequest) {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const settingsUrl = `${baseUrl}/?slackStatus=`;

    // ── 1. Auth guard ──────────────────────────────────────────────────────────
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.redirect(`${settingsUrl}error&reason=unauthenticated`);
    }

    // ── 2. Validate OAuth code ─────────────────────────────────────────────────
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error || !code) {
        console.error('[Slack Callback] OAuth error or missing code:', error);
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
            console.error('[Slack Callback] Token exchange failed:', tokenData);
            return NextResponse.redirect(`${settingsUrl}error&reason=token_exchange`);
        }
    } catch (err) {
        console.error('[Slack Callback] Network error during token exchange:', err);
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
        console.error('[Slack Callback] Failed to upsert IntegrationAccount:', err);
        return NextResponse.redirect(`${settingsUrl}error&reason=db_write`);
    }

    // ── 5. Redirect back to settings ───────────────────────────────────────────
    return NextResponse.redirect(`${settingsUrl}connected`);
}
