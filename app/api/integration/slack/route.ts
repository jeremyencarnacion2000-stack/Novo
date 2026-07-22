/**
 * /api/integration/slack
 *
 * GET  — Returns connection status + selected channel
 * DELETE — Disconnects Slack (removes IntegrationAccount row)
 * POST — Channel management + test message
 *         Query: ?action=channels | save_channel | test
 */

import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { slackService } from '@/lib/slack';

// ── GET — Connection status ─────────────────────────────────────────────────

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const account = await prisma.integrationAccount.findUnique({
        where: {
            userId_provider: { userId: session.user.id, provider: 'slack' },
        },
    });

    if (!account) {
        return NextResponse.json({ connected: false });
    }

    const meta = account.metadata as any;

    return NextResponse.json({
        connected: true,
        teamName: meta?.teamName ?? null,
        channelId: meta?.channelId ?? null,
        channelName: meta?.channelName ?? null,
        connectedAt: account.createdAt,
        updatedAt: account.updatedAt,
    });
}

// ── DELETE — Disconnect ──────────────────────────────────────────────────────

export async function DELETE() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        await prisma.integrationAccount.delete({
            where: {
                userId_provider: { userId: session.user.id, provider: 'slack' },
            },
        });
        return NextResponse.json({ disconnected: true });
    } catch {
        return NextResponse.json({ disconnected: true });
    }
}

// ── POST — Channel management + test message ─────────────────────────────────

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') ?? 'channels';

    const account = await prisma.integrationAccount.findUnique({
        where: {
            userId_provider: { userId: session.user.id, provider: 'slack' },
        },
    });

    if (!account) {
        return NextResponse.json({ error: 'Slack not connected' }, { status: 400 });
    }

    const meta = account.metadata as any;

    // ── action=channels — list available channels ─────────────────────────────
    if (action === 'channels') {
        try {
            const channels = await slackService.listChannels(account.accessToken);
            return NextResponse.json({ channels });
        } catch (err: any) {
            console.error('[Slack] Failed to list channels:', err);
            return NextResponse.json({ error: 'Failed to fetch channels', detail: err.message }, { status: 502 });
        }
    }

    // ── action=save_channel — persist the chosen destination channel ──────────
    if (action === 'save_channel') {
        const body = await req.json().catch(() => ({}));
        const channelId: string | null = body.channelId ?? null;
        const channelName: string | null = body.channelName ?? null;
        await prisma.integrationAccount.update({
            where: { userId_provider: { userId: session.user.id, provider: 'slack' } },
            data: {
                metadata: { ...meta, channelId, channelName },
            },
        });
        return NextResponse.json({ saved: true, channelId, channelName });
    }

    // ── action=test — send a test message to the selected channel ─────────────
    if (action === 'test') {
        const channelId: string | null = meta?.channelId ?? null;
        if (!channelId) {
            return NextResponse.json(
                { error: 'No hay canal seleccionado. Elige un canal primero.' },
                { status: 400 },
            );
        }
        try {
            await slackService.postMessage(
                account.accessToken,
                channelId,
                '👋 Novo está conectado a este canal. Aquí llegarán tus alertas del motor cognitivo.',
            );
            return NextResponse.json({ sent: true });
        } catch (err: any) {
            console.error('[Slack] Test message failed:', err);
            return NextResponse.json({ error: 'Failed to send test message', detail: err.message }, { status: 502 });
        }
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
