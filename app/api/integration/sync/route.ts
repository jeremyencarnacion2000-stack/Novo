import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { IntegrationEngine } from '@/lib/integration-engine';
import { z } from 'zod';

const syncCompletionSchema = z.object({
    taskId: z.string().min(1).max(200),
    completed: z.boolean(),
});

// POST /api/integration/sync - Sync task completion across sources
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const parsed = syncCompletionSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Missing taskId or completed status' },
                { status: 400 }
            );
        }

        const { taskId, completed } = parsed.data;

        const persisted = await IntegrationEngine.syncCompletion(taskId, completed);
        if (!persisted) {
            return NextResponse.json(
                { error: 'This item cannot be marked complete' },
                { status: 422 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error syncing completion:', { name: error instanceof Error ? error.name : 'UnknownError' });
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
