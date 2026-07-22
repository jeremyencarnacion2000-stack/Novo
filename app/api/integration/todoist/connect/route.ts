/**
 * GET /api/integration/todoist/connect
 *
 * Initiates the Todoist OAuth 2.0 authorization flow.
 *
 * Required env vars:
 *   TODOIST_CLIENT_ID     — from a Todoist App (https://developer.todoist.com/appconsole.html)
 *   TODOIST_CLIENT_SECRET
 *   TODOIST_REDIRECT_URI  — must match exactly what's registered for the app (e.g. https://yourapp.com/api/integration/todoist/callback)
 */

import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientId = process.env.TODOIST_CLIENT_ID;
    const redirectUri = process.env.TODOIST_REDIRECT_URI;

    if (!clientId || !redirectUri) {
        return NextResponse.json(
            { error: 'Todoist integration is not configured. Set TODOIST_CLIENT_ID and TODOIST_REDIRECT_URI.' },
            { status: 503 },
        );
    }

    const params = new URLSearchParams({
        client_id: clientId,
        scope: 'data:read_write',
        redirect_uri: redirectUri,
        state: session.user.id, // Todoist doesn't send the redirect_uri back on callback, just state — used to correlate if ever needed
    });

    return NextResponse.redirect(`https://todoist.com/oauth/authorize?${params.toString()}`);
}
