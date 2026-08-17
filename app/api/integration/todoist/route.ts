/**
 * /api/integration/todoist
 *
 * GET  — Returns connection status
 * DELETE — Disconnects Todoist (removes IntegrationAccount row)
 * POST — Runs a sync: fetches Todoist tasks and upserts them as ChecklistItems
 *         Query: ?action=projects | save_projects | sync
 */

import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { todoistService } from '@/lib/todoist';
import { z } from 'zod';

const todoistActionSchema = z.enum(['projects', 'save_projects', 'sync']);
const saveProjectsSchema = z.object({
    projectIds: z.array(z.string().min(1).max(200)).max(500),
});

// ── GET — Connection status ─────────────────────────────────────────────────

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const account = await prisma.integrationAccount.findUnique({
        where: {
            userId_provider: { userId: session.user.id, provider: 'todoist' },
        },
    });

    if (!account) {
        return NextResponse.json({ connected: false });
    }

    const meta = account.metadata as any;

    return NextResponse.json({
        connected: true,
        projectIds: meta?.projectIds ?? [],
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
                userId_provider: { userId: session.user.id, provider: 'todoist' },
            },
        });
        return NextResponse.json({ disconnected: true });
    } catch {
        // Record didn't exist — treat as success
        return NextResponse.json({ disconnected: true });
    }
}

// ── POST — Sync or project management ─────────────────────────────────────────

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const actionParsed = todoistActionSchema.safeParse(searchParams.get('action') ?? 'sync');
    if (!actionParsed.success) {
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    const action = actionParsed.data;

    const account = await prisma.integrationAccount.findUnique({
        where: {
            userId_provider: { userId: session.user.id, provider: 'todoist' },
        },
    });

    if (!account) {
        return NextResponse.json({ error: 'Todoist not connected' }, { status: 400 });
    }

    const meta = account.metadata as any;

    // ── action=projects — list available projects ─────────────────────────────
    if (action === 'projects') {
        try {
            const projects = await todoistService.listProjects(account.accessToken);
            return NextResponse.json({ projects });
        } catch (err) {
            console.error('[Todoist] Failed to list projects:', { name: err instanceof Error ? err.name : 'UnknownError' });
            return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 502 });
        }
    }

    // ── action=save_projects — persist chosen project IDs ─────────────────────
    if (action === 'save_projects') {
        const body = await req.json().catch(() => ({}));
        const parsed = saveProjectsSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'projectIds inválido' }, { status: 400 });
        }
        const projectIds = parsed.data.projectIds;
        await prisma.integrationAccount.update({
            where: { userId_provider: { userId: session.user.id, provider: 'todoist' } },
            data: {
                metadata: { ...meta, projectIds },
            },
        });
        return NextResponse.json({ saved: true, projectIds });
    }

    // ── action=sync — fetch tasks and upsert as ChecklistItems ────────────────
    if (action === 'sync') {
        const projectIds: string[] = meta?.projectIds ?? [];
        if (projectIds.length === 0) {
            return NextResponse.json(
                { error: 'No Todoist projects selected. Go to Integrations settings to select projects.' },
                { status: 400 },
            );
        }

        try {
            const tasks = await todoistService.fetchAllTasks(account.accessToken, projectIds);

            let created = 0;
            let updated = 0;

            for (const task of tasks) {
                const existing = await prisma.checklistItem.findFirst({
                    where: { userId: session.user.id, sourceId: task.sourceId, source: 'todoist' },
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
                            source: 'todoist',
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
            console.error('[Todoist] Sync error:', { name: err instanceof Error ? err.name : 'UnknownError' });
            return NextResponse.json({ error: 'Sync failed' }, { status: 502 });
        }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
