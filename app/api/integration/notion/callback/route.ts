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

export async function GET(req: NextRequest) {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const settingsUrl = `${baseUrl}/?notionStatus=`;

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
        console.error('[Notion Callback] OAuth error or missing code:', error);
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
            const errBody = await tokenRes.text();
            console.error('[Notion Callback] Token exchange failed:', errBody);
            return NextResponse.redirect(`${settingsUrl}error&reason=token_exchange`);
        }

        tokenData = await tokenRes.json();
    } catch (err) {
        console.error('[Notion Callback] Network error during token exchange:', err);
        return NextResponse.redirect(`${settingsUrl}error&reason=network`);
    }

    // ── 4. Upsert IntegrationAccount ───────────────────────────────────────────
    // tokenData shape: { access_token, token_type, bot_id, workspace_id, workspace_name, ... }
    try {
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
                    workspaceId: tokenData.workspace_id ?? null,
                    workspaceName: tokenData.workspace_name ?? null,
                    botId: tokenData.bot_id ?? null,
                    // Preserve existing databaseIds on re-connect
                },
                updatedAt: new Date(),
            },
        });

        console.log(`✅ [Notion] Connected for user ${session.user.id}, workspace: ${tokenData.workspace_name}`);
    } catch (err) {
        console.error('[Notion Callback] Failed to upsert IntegrationAccount:', err);
        return NextResponse.redirect(`${settingsUrl}error&reason=db_write`);
    }

    // ── 5. Redirect back to settings ───────────────────────────────────────────
    return NextResponse.redirect(`${settingsUrl}connected`);
}
