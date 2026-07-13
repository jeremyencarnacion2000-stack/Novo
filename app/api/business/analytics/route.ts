import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/business/analytics - Get business analytics
export async function GET(request: NextRequest) {
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

        // Get all deals
        const deals = await prisma.deal.findMany({
            where: { userId: user.id },
        });

        // Get all clients
        const clients = await prisma.businessClient.findMany({
            where: { userId: user.id },
        });

        // Calculate pipeline value by stage
        const pipelineByStage = deals.reduce((acc, deal) => {
            if (!acc[deal.stage]) {
                acc[deal.stage] = { count: 0, value: 0 };
            }
            acc[deal.stage].count++;
            acc[deal.stage].value += deal.value;
            return acc;
        }, {} as Record<string, { count: number; value: number }>);

        // Calculate total pipeline value (excluding lost)
        const totalPipelineValue = deals
            .filter(d => d.stage !== 'lost')
            .reduce((sum, d) => sum + d.value, 0);

        // Weighted pipeline (value * probability)
        const weightedPipeline = deals
            .filter(d => !['won', 'lost'].includes(d.stage))
            .reduce((sum, d) => sum + (d.value * d.probability / 100), 0);

        // Won deals
        const wonDeals = deals.filter(d => d.stage === 'won');
        const totalRevenue = wonDeals.reduce((sum, d) => sum + d.value, 0);

        // Conversion rate
        const closedDeals = deals.filter(d => ['won', 'lost'].includes(d.stage));
        const conversionRate = closedDeals.length > 0
            ? (wonDeals.length / closedDeals.length) * 100
            : 0;

        // Average deal size
        const avgDealSize = wonDeals.length > 0
            ? totalRevenue / wonDeals.length
            : 0;

        // Client stats
        const activeClients = clients.filter(c => c.status === 'active').length;
        const prospects = clients.filter(c => c.status === 'lead' || c.status === 'prospect').length;

        return NextResponse.json({
            summary: {
                totalClients: clients.length,
                activeClients,
                prospects,
                totalDeals: deals.length,
                openDeals: deals.filter(d => !['won', 'lost'].includes(d.stage)).length,
                wonDeals: wonDeals.length,
                totalRevenue,
                totalPipelineValue,
                weightedPipeline,
                conversionRate,
                avgDealSize,
            },
            pipelineByStage,
        });
    } catch (error) {
        console.error('Error fetching business analytics:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
