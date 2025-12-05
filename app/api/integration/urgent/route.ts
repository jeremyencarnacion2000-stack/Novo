import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { IntegrationEngine } from '@/lib/integration-engine';

// GET /api/integration/urgent - Get urgent school items
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession();

        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const urgentItems = await IntegrationEngine.getUrgentItems(user.id);

        return NextResponse.json({ urgentItems });
    } catch (error) {
        console.error('Error fetching urgent items:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
