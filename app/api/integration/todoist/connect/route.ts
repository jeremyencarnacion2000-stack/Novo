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
import { createTodoistOAuthState, hashTodoistNonce, parseTodoistOAuthState } from '@/lib/todoist-oauth-state';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientId = process.env.TODOIST_CLIENT_ID;
    const redirectUri = process.env.TODOIST_REDIRECT_URI;

    if (!clientId || !redirectUri) {
        // A connect button is a browser navigation, so returning raw JSON leaves
        // the user on an opaque error page. Keep the failure fail-closed while
        // returning them to the product with a recoverable, non-sensitive state.
        const url = new URL('/connectors', request.url);
        url.searchParams.set('integrationStatus', 'unconfigured');
        url.searchParams.set('provider', 'todoist');
        return NextResponse.redirect(url);
    }

    const state = createTodoistOAuthState(session.user.id);
    const payload = parseTodoistOAuthState(state);
    if (!payload) return NextResponse.json({ error: 'Unable to create OAuth state' }, { status: 503 });
    await prisma.todoistOAuthState.create({ data: { provider: 'todoist', userId: session.user.id, nonceHash: hashTodoistNonce(payload.nonce), expiresAt: new Date(payload.issuedAt + 600000) } });
    const cookieStore = await cookies();
    cookieStore.set('novo_todoist_oauth_state', state, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 600, path: '/' });
    const params = new URLSearchParams({
        client_id: clientId,
        scope: 'data:read_write',
        redirect_uri: redirectUri,
        state,
    });

    return NextResponse.redirect(`https://todoist.com/oauth/authorize?${params.toString()}`);
}
