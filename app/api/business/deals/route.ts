import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createDealSchema = z.object({
    title: z.string().min(1).max(500),
    value: z.union([z.number(), z.string().regex(/^\d+(\.\d+)?$/)]),
    stage: z.string().min(1).max(100),
    probability: z.number().min(0).max(100).optional(),
    expectedClose: z.string().max(100).optional().nullable(),
    notes: z.string().max(5000).optional().nullable(),
    clientId: z.string().min(1).max(200),
});

// GET /api/business/deals - Get all deals
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

        const body = await request.json();
        const parsed = createDealSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const { title, value, stage, probability, expectedClose, notes, clientId } = parsed.data;

        const deal = await prisma.deal.create({
            data: {
                title,
                value: typeof value === 'number' ? value : parseFloat(value),
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
