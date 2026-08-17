/**
 * /api/integration/notion
 *
 * GET  — Returns connection status + workspace metadata
 * DELETE — Disconnects Notion (removes IntegrationAccount row)
 * POST — Runs a sync: fetches Notion database pages and upserts them as ChecklistItems
 *         Query: ?action=sync
 *         Body: { databaseId?: string }  — if provided, syncs only that DB; otherwise syncs all saved DBs
 */

import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notionService } from '@/lib/notion';
import { z } from 'zod';

const notionActionSchema = z.enum(['databases', 'save_databases', 'sync']);
const saveDatabasesSchema = z.object({
    databaseIds: z.array(z.string().min(1).max(200)).max(500),
});

// ── GET — Connection status ─────────────────────────────────────────────────

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const account = await prisma.integrationAccount.findUnique({
        where: {
            userId_provider: { userId: session.user.id, provider: 'notion' },
        },
    });

    if (!account) {
        return NextResponse.json({ connected: false });
    }

    const meta = account.metadata as any;

    return NextResponse.json({
        connected: true,
        workspaceName: meta?.workspaceName ?? null,
        workspaceId: meta?.workspaceId ?? null,
        databaseIds: meta?.databaseIds ?? [],
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
                userId_provider: { userId: session.user.id, provider: 'notion' },
            },
        });
        return NextResponse.json({ disconnected: true });
    } catch {
        // Record didn't exist — treat as success
        return NextResponse.json({ disconnected: true });
    }
}

// ── POST — Sync or database management ──────────────────────────────────────

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const actionParsed = notionActionSchema.safeParse(searchParams.get('action') ?? 'sync');
    if (!actionParsed.success) {
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    const action = actionParsed.data;

    const account = await prisma.integrationAccount.findUnique({
        where: {
            userId_provider: { userId: session.user.id, provider: 'notion' },
        },
    });

    if (!account) {
        return NextResponse.json({ error: 'Notion not connected' }, { status: 400 });
    }

    const meta = account.metadata as any;

    // ── action=databases — list available databases ───────────────────────────
    if (action === 'databases') {
        try {
            const databases = await notionService.listDatabases(account.accessToken);
            return NextResponse.json({ databases });
        } catch (err) {
            console.error('[Notion] Failed to list databases:', { name: err instanceof Error ? err.name : 'UnknownError' });
            return NextResponse.json({ error: 'Failed to fetch databases' }, { status: 502 });
        }
    }

    // ── action=save_databases — persist chosen database IDs ──────────────────
    if (action === 'save_databases') {
        const body = await req.json().catch(() => ({}));
        const parsed = saveDatabasesSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'databaseIds inválido' }, { status: 400 });
        }
        const databaseIds = parsed.data.databaseIds;
        await prisma.integrationAccount.update({
            where: { userId_provider: { userId: session.user.id, provider: 'notion' } },
            data: {
                metadata: { ...meta, databaseIds },
            },
        });
        return NextResponse.json({ saved: true, databaseIds });
    }

    // ── action=sync — fetch pages and upsert as ChecklistItems ──────────────
    if (action === 'sync') {
        const databaseIds: string[] = meta?.databaseIds ?? [];
        if (databaseIds.length === 0) {
            return NextResponse.json(
                { error: 'No Notion databases selected. Go to Integrations settings to select databases.' },
                { status: 400 },
            );
        }

        try {
            const tasks = await notionService.fetchAllTasks(account.accessToken, databaseIds);

            let created = 0;
            let updated = 0;

            for (const task of tasks) {
                const existing = await prisma.checklistItem.findFirst({
                    where: { userId: session.user.id, sourceId: task.sourceId, source: 'notion' },
                });

                if (existing) {
                    await prisma.checklistItem.update({
                        where: { id: existing.id },
                        data: {
                            text: task.text,
                            completed: task.completed,
                            priority: task.priority,
                            dueDate: task.dueDate ?? null,
                        },
                    });
                    updated++;
                } else {
                    await prisma.checklistItem.create({
                        data: {
                            userId: session.user.id,
                            text: task.text,
                            completed: task.completed,
                            priority: task.priority,
                            source: 'notion',
                            sourceId: task.sourceId,
                            dueDate: task.dueDate ?? null,
                        },
                    });
                    created++;
                }
            }

            return NextResponse.json({
                synced: true,
                total: tasks.length,
                created,
                updated,
            });
        } catch (err) {
            console.error('[Notion] Sync error:', { name: err instanceof Error ? err.name : 'UnknownError' });
            return NextResponse.json({ error: 'Sync failed' }, { status: 502 });
        }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
