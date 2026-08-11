/**
 * GET /api/integration/todoist/callback
 *
 * Receives the OAuth `code` from Todoist after user authorization,
 * exchanges it for an access token, and upserts an IntegrationAccount
 * record for this user.
 *
 * Redirects to /settings with a ?todoistStatus= query param so the UI
 * can display a success/error toast.
 */

import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { hashTodoistNonce, parseTodoistOAuthState } from '@/lib/todoist-oauth-state';

export async function GET(req: NextRequest) {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const settingsUrl = `${baseUrl}/?todoistStatus=`;

    // ── 1. Auth guard ──────────────────────────────────────────────────────────
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.redirect(`${settingsUrl}error&reason=unauthenticated`);
    }

    // ── 2. Validate OAuth code ─────────────────────────────────────────────────
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const storedState = cookies().get('novo_todoist_oauth_state')?.value;
    cookies().delete('novo_todoist_oauth_state');
    const payload = parseTodoistOAuthState(state);
    if (!storedState || state !== storedState || !payload || payload.userId !== session.user.id) {
        return NextResponse.redirect(`${settingsUrl}error&reason=invalid_state`);
    }
    const claimed = await prisma.todoistOAuthState.updateMany({
        where: { provider: 'todoist', userId: session.user.id, nonceHash: hashTodoistNonce(payload.nonce), status: 'issued', consumedAt: null, expiresAt: { gt: new Date() } },
        data: { status: 'consumed', consumedAt: new Date() },
    });
    if (claimed.count !== 1) return NextResponse.redirect(`${settingsUrl}error&reason=invalid_state`);
    const error = searchParams.get('error');

    if (error || !code) {
        console.error('[Todoist Callback] OAuth error or missing code:', error);
        return NextResponse.redirect(`${settingsUrl}error&reason=denied`);
    }

    // ── 3. Exchange code for access token ──────────────────────────────────────
    const clientId = process.env.TODOIST_CLIENT_ID!;
    const clientSecret = process.env.TODOIST_CLIENT_SECRET!;
    const redirectUri = process.env.TODOIST_REDIRECT_URI!;

    let tokenData: any;
    try {
        const tokenRes = await fetch('https://todoist.com/oauth/access_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                code,
                redirect_uri: redirectUri,
            }),
        });

        if (!tokenRes.ok) {
            const errBody = await tokenRes.text();
            console.error('[Todoist Callback] Token exchange failed:', errBody);
            return NextResponse.redirect(`${settingsUrl}error&reason=token_exchange`);
        }

        tokenData = await tokenRes.json();
        if (!tokenData.access_token) {
            console.error('[Todoist Callback] Token response missing access_token:', tokenData);
            return NextResponse.redirect(`${settingsUrl}error&reason=token_exchange`);
        }
    } catch (err) {
        console.error('[Todoist Callback] Network error during token exchange:', err);
        return NextResponse.redirect(`${settingsUrl}error&reason=network`);
    }

    // ── 4. Upsert IntegrationAccount ───────────────────────────────────────────
    // Fetches the existing row first and spreads its metadata, so a
    // re-connect never silently wipes previously-selected projectIds (same
    // bug just fixed in the Notion callback — built correctly here from
    // the start instead of copying it).
    try {
        const existing = await prisma.integrationAccount.findUnique({
            where: { userId_provider: { userId: session.user.id, provider: 'todoist' } },
            select: { metadata: true },
        });
        const existingMeta = (existing?.metadata as any) ?? {};

        await prisma.integrationAccount.upsert({
            where: {
                userId_provider: {
                    userId: session.user.id,
                    provider: 'todoist',
                },
            },
            create: {
                userId: session.user.id,
                provider: 'todoist',
                accessToken: tokenData.access_token,
                tokenType: 'Bearer',
                metadata: {
                    // No projects selected yet — user picks them from settings UI
                    projectIds: [],
                },
            },
            update: {
                accessToken: tokenData.access_token,
                tokenType: 'Bearer',
                metadata: {
                    ...existingMeta,
                    projectIds: existingMeta.projectIds ?? [],
                },
                updatedAt: new Date(),
            },
        });

        console.log(`✅ [Todoist] Connected for user ${session.user.id}`);
    } catch (err) {
        console.error('[Todoist Callback] Failed to upsert IntegrationAccount:', err);
        return NextResponse.redirect(`${settingsUrl}error&reason=db_write`);
    }

    // ── 5. Redirect back to settings ───────────────────────────────────────────
    return NextResponse.redirect(`${settingsUrl}connected`);
}
