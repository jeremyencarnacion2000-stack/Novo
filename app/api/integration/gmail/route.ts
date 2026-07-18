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
import { prisma } from '@/lib/prisma';
import { gmailService } from '@/lib/google';

// ── GET — Check Connection / Scope Status ────────────────────────────────────

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const googleAccount = await prisma.account.findFirst({
        where: {
            userId: session.user.id,
            provider: 'google',
        },
    });

    if (!googleAccount) {
        return NextResponse.json({
            connected: false,
            hasScope: false,
            message: 'Google account not connected to Novo',
        });
    }

    const scopes = googleAccount.scope || '';
    const hasGmailScope = scopes.includes('gmail');

    return NextResponse.json({
        connected: true,
        hasScope: hasGmailScope,
    });
}

// ── POST — List Unread ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const googleAccount = await prisma.account.findFirst({
        where: {
            userId: session.user.id,
            provider: 'google',
        },
    });

    if (!googleAccount) {
        return NextResponse.json({ error: 'Google account not connected' }, { status: 400 });
    }

    const scopes = googleAccount.scope || '';
    const hasGmailScope = scopes.includes('gmail');

    if (!hasGmailScope) {
        return NextResponse.json({
            error: 'Insufficient permission. Gmail access not granted.',
            code: 'MISSING_GMAIL_SCOPE',
        }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    if (body.action !== 'list_unread') {
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    try {
        const emails = await gmailService.listUnread(10);
        return NextResponse.json({ success: true, emails });
    } catch (err: any) {
        console.error('[Gmail] List unread failed:', err);
        return NextResponse.json({
            error: 'Failed to fetch unread emails',
            detail: err.message || err,
        }, { status: 502 });
    }
}
