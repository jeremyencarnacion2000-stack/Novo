/**
 * /api/integration/gmail
 *
 * GET  — Checks if the Google integration includes Gmail scope.
 * POST — { action: 'list_unread' } fetches the user's unread Gmail messages
 *        (display-only, no persistence — mirrors calendar's read path minus
 *        the DB sync since there's no Novo-internal email model).
 */

import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { gmailService } from '@/lib/google';
import { findGoogleAccountForScopes } from '@/lib/google-account';
import { isGmailReauthorizationError } from '@/lib/ai/gmail-context';

// ── GET — Check Connection / Scope Status ────────────────────────────────────

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const googleAccount = await findGoogleAccountForScopes(session.user.id, ['gmail.readonly']);

    if (!googleAccount) {
        return NextResponse.json({
            connected: false,
            hasScope: false,
            state: 'not_connected',
            message: 'Google account not connected to Novo',
        });
    }

    try {
        await gmailService.checkAccessForUser(session.user.id);
        return NextResponse.json({ connected: true, hasScope: true, state: 'connected' });
    } catch (error) {
        console.error('[Gmail] Connection check failed.');
        return NextResponse.json({
            connected: true,
            hasScope: true,
            state: isGmailReauthorizationError(error) ? 'reauthorization_required' : 'unavailable',
        });
    }
}

// ── POST — List Unread ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const googleAccount = await findGoogleAccountForScopes(session.user.id, ['gmail.readonly']);

    if (!googleAccount) {
        return NextResponse.json({ error: 'Google account not connected' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    if (body.action !== 'list_unread') {
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    try {
        const emails = await gmailService.listUnreadForUser(session.user.id, 10);
        return NextResponse.json({ success: true, emails });
    } catch (error) {
        console.error('[Gmail] List unread failed.');
        if (isGmailReauthorizationError(error)) {
            return NextResponse.json({
                error: 'Gmail authorization needs renewal',
                code: 'GMAIL_REAUTH_REQUIRED',
                reconnectPath: '/connectors?reconnect=gmail',
            }, { status: 409 });
        }
        return NextResponse.json({
            error: 'Failed to fetch unread emails',
            code: 'GMAIL_UNAVAILABLE',
        }, { status: 502 });
    }
}
