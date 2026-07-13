import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { IntegrationEngine } from '@/lib/integration-engine';

// POST /api/integration/sync - Sync task completion across sources
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const { taskId, completed } = await request.json();

        if (!taskId || completed === undefined) {
            return NextResponse.json(
                { error: 'Missing taskId or completed status' },
                { status: 400 }
            );
        }

        await IntegrationEngine.syncCompletion(taskId, completed);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error syncing completion:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
