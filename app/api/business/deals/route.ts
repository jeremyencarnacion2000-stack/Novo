import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// GET /api/business/deals - Get all deals
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

        const { searchParams } = new URL(request.url);
        const stage = searchParams.get('stage');
        const clientId = searchParams.get('clientId');

        const where: any = { userId: user.id };
        if (stage) where.stage = stage;
        if (clientId) where.clientId = clientId;

        const deals = await prisma.deal.findMany({
            where,
            include: {
                client: {
                    select: {
                        id: true,
                        name: true,
                        company: true,
                    },
                },
            },
            orderBy: { updatedAt: 'desc' },
        });

        return NextResponse.json({ deals });
    } catch (error) {
        console.error('Error fetching deals:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// POST /api/business/deals - Create a deal
export async function POST(request: NextRequest) {
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

        const body = await request.json();
        const { title, value, stage, probability, expectedClose, notes, clientId } = body;

        if (!title || value === undefined || !stage || !clientId) {
            return NextResponse.json(
                { error: 'Missing required fields: title, value, stage, clientId' },
                { status: 400 }
            );
        }

        const deal = await prisma.deal.create({
            data: {
                title,
                value: parseFloat(value),
                stage,
                probability: probability ?? 50,
                expectedClose: expectedClose ? new Date(expectedClose) : null,
                notes,
                clientId,
                userId: user.id,
            },
            include: {
                client: {
                    select: {
                        id: true,
                        name: true,
                        company: true,
                    },
                },
            },
        });

        return NextResponse.json({ deal });
    } catch (error) {
        console.error('Error creating deal:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
