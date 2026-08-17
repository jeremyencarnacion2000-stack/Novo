/**
 * GET /api/integration/notion/callback
 *
 * Receives the OAuth `code` from Notion after user authorization,
 * exchanges it for an access token, and upserts an IntegrationAccount
 * record for this user.
 *
 * Redirects to /settings with a ?notionStatus= query param so the UI
 * can display a success/error toast.
 */

import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { hashOAuthNonce, parseIntegrationOAuthState } from '@/lib/todoist-oauth-state';

export async function GET(req: NextRequest) {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const settingsUrl = `${baseUrl}/?notionStatus=`;

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
    const storedState = cookieStore.get('novo_notion_oauth_state')?.value;
    cookieStore.delete('novo_notion_oauth_state');
    const payload = parseIntegrationOAuthState(state, 'notion');
    if (!storedState || state !== storedState || !payload || payload.userId !== session.user.id) {
        return NextResponse.redirect(`${settingsUrl}error&reason=invalid_state`);
    }

    const claimed = await prisma.todoistOAuthState.updateMany({
        where: {
            provider: 'notion',
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
        console.error('[Notion Callback] OAuth denied or missing code:', { reason: error ? error.slice(0, 80) : 'missing_code' });
        return NextResponse.redirect(`${settingsUrl}error&reason=denied`);
    }

    // ── 3. Exchange code for access token ──────────────────────────────────────
    const clientId = process.env.NOTION_CLIENT_ID!;
    const clientSecret = process.env.NOTION_CLIENT_SECRET!;
    const redirectUri = process.env.NOTION_REDIRECT_URI!;

    let tokenData: any;
    try {
        const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        const tokenRes = await fetch('https://api.notion.com/v1/oauth/token', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28',
            },
            body: JSON.stringify({
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri,
            }),
        });

        if (!tokenRes.ok) {
            const errBody = await tokenRes.text().catch(() => '');
            console.error('[Notion Callback] Token exchange failed:', { status: tokenRes.status, bodyLength: errBody.length });
            return NextResponse.redirect(`${settingsUrl}error&reason=token_exchange`);
        }

        tokenData = await tokenRes.json();
    } catch (err) {
        console.error('[Notion Callback] Network error during token exchange:', { name: err instanceof Error ? err.name : 'UnknownError' });
        return NextResponse.redirect(`${settingsUrl}error&reason=network`);
    }

    // ── 4. Upsert IntegrationAccount ───────────────────────────────────────────
    // tokenData shape: { access_token, token_type, bot_id, workspace_id, workspace_name, ... }
    try {
        // The update branch's comment claimed "Preserve existing databaseIds
        // on re-connect" but the object it wrote never actually included
        // databaseIds - any re-connect (disconnect+reconnect, or just
        // clicking "Conectar Notion" again while already connected) silently
        // wiped out every previously-selected database back to none, which
        // would reproduce the exact "still 0 seleccionadas" symptom even
        // after a user had genuinely picked some before. Fetching the
        // existing row first and spreading its metadata actually preserves it.
        const existing = await prisma.integrationAccount.findUnique({
            where: { userId_provider: { userId: session.user.id, provider: 'notion' } },
            select: { metadata: true },
        });
        const existingMeta = (existing?.metadata as any) ?? {};

        await prisma.integrationAccount.upsert({
            where: {
                userId_provider: {
                    userId: session.user.id,
                    provider: 'notion',
                },
            },
            create: {
                userId: session.user.id,
                provider: 'notion',
                accessToken: tokenData.access_token,
                tokenType: tokenData.token_type,
                metadata: {
                    workspaceId: tokenData.workspace_id ?? null,
                    workspaceName: tokenData.workspace_name ?? null,
                    botId: tokenData.bot_id ?? null,
                    // No databases selected yet — user picks them from settings UI
                    databaseIds: [],
                },
            },
            update: {
                accessToken: tokenData.access_token,
                tokenType: tokenData.token_type,
                metadata: {
                    ...existingMeta,
                    workspaceId: tokenData.workspace_id ?? null,
                    workspaceName: tokenData.workspace_name ?? null,
                    botId: tokenData.bot_id ?? null,
                    databaseIds: existingMeta.databaseIds ?? [],
                },
                updatedAt: new Date(),
            },
        });

        console.log(`✅ [Notion] Connected for user ${session.user.id}, workspace: ${tokenData.workspace_name}`);
    } catch (err) {
        console.error('[Notion Callback] Failed to upsert IntegrationAccount:', { name: err instanceof Error ? err.name : 'UnknownError' });
        return NextResponse.redirect(`${settingsUrl}error&reason=db_write`);
    }

    // ── 5. Redirect back to settings ───────────────────────────────────────────
    return NextResponse.redirect(`${settingsUrl}connected`);
}
