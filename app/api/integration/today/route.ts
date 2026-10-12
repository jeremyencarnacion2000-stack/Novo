import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { IntegrationEngine } from '@/lib/integration-engine';

export const dynamic = 'force-dynamic';

// GET /api/integration/today - Get all tasks for today
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, {
                status: 401,
                headers: { 'Cache-Control': 'private, no-store, max-age=0' },
            });
        }

        const tasks = await IntegrationEngine.getTodayTasks(session.user.id);

        const response = NextResponse.json({ tasks });
        response.headers.set('Cache-Control', 'private, no-store, max-age=0');
        return response;
    } catch (error) {
        console.error('Error fetching today tasks.');
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
