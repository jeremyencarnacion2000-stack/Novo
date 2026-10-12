import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateDealSchema = z.object({
    title: z.string().trim().min(1).max(500).optional(),
    value: z.union([z.number().finite(), z.string().regex(/^\d+(\.\d+)?$/)]).optional(),
    stage: z.string().trim().min(1).max(100).optional(),
    probability: z.number().finite().min(0).max(100).optional(),
    expectedClose: z.string().trim().max(100).refine((value) => Number.isFinite(Date.parse(value)), 'expectedClose must be a valid date').optional().nullable(),
    notes: z.string().max(5000).optional().nullable(),
});

// PUT /api/business/deals/[id] - Update a deal
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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

        const { id } = await params;
        const body = await request.json();
        const parsed = updateDealSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
        }
        const { title, value, stage, probability, expectedClose, notes } = parsed.data;

        // Verify ownership
        const existing = await prisma.deal.findFirst({
            where: { id, userId: user.id },
        });

        if (!existing) {
            return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
        }

        const deal = await prisma.deal.update({
            where: { id },
            data: {
                ...(title !== undefined && { title }),
                ...(value !== undefined && { value: typeof value === 'number' ? value : parseFloat(value) }),
                ...(stage && { stage }),
                ...(probability !== undefined && { probability }),
                ...(expectedClose && { expectedClose: new Date(expectedClose) }),
                ...(notes !== undefined && { notes }),
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

        // Update client revenue if deal is won
        if (stage === 'won' && existing.stage !== 'won') {
            await prisma.businessClient.update({
                where: { id: deal.clientId },
                data: {
                    totalRevenue: { increment: deal.value },
                },
            });
        }

        return NextResponse.json({ deal });
    } catch (error) {
        console.error('Error updating deal.');
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// DELETE /api/business/deals/[id] - Delete a deal
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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

        const { id } = await params;

        // Verify ownership
        const existing = await prisma.deal.findFirst({
            where: { id, userId: user.id },
        });

        if (!existing) {
            return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
        }

        await prisma.deal.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting deal.');
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
