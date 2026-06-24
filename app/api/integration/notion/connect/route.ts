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

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientId = process.env.NOTION_CLIENT_ID;
    const redirectUri = process.env.NOTION_REDIRECT_URI;

    if (!clientId || !redirectUri) {
        return NextResponse.json(
            { error: 'Notion integration is not configured. Set NOTION_CLIENT_ID and NOTION_REDIRECT_URI.' },
            { status: 503 },
        );
    }

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        owner: 'user', // Request user-level access (not workspace-level)
    });

    const notionOAuthUrl = `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;

    return NextResponse.redirect(notionOAuthUrl);
}
