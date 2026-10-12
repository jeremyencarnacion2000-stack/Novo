import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import {
    createMutationFingerprint,
    IdempotencyConflictError,
    readIdempotencyKey,
    runIdempotentCreate,
} from '@/lib/server-idempotency';

const createDealSchema = z.object({
    title: z.string().trim().min(1).max(500),
    value: z.union([z.number().finite(), z.string().regex(/^\d+(\.\d+)?$/)]),
    stage: z.string().trim().min(1).max(100),
    probability: z.number().finite().min(0).max(100).optional(),
    expectedClose: z.string().trim().max(100).refine((value) => Number.isFinite(Date.parse(value)), 'expectedClose must be a valid date').optional().nullable(),
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
        console.error('Error fetching deals.');
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

        // The deal's relation must be owned by the same user. Without this
        // check a valid clientId from another account could be attached to a
        // new deal and later exposed through the include below.
        const client = await prisma.businessClient.findFirst({
            where: { id: clientId, userId: user.id },
            select: { id: true },
        });
        if (!client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }

        const { key: idempotencyKey, invalid } = readIdempotencyKey(request);
        if (invalid) return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 });

        const result = await runIdempotentCreate(prisma, {
            userId: user.id,
            scope: 'business_deal_create',
            idempotencyKey,
            fingerprint: createMutationFingerprint(parsed.data),
            resourceType: 'deal',
            create: (db) => db.deal.create({
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
                    client: { select: { id: true, name: true, company: true } },
                },
            }),
            findResource: (resourceId, db) => db.deal.findFirst({
                where: { id: resourceId, userId: user.id },
                include: {
                    client: { select: { id: true, name: true, company: true } },
                },
            }),
        });

        return NextResponse.json({ deal: result.resource }, {
            status: result.replay ? 200 : 201,
            headers: { 'X-Idempotent-Replay': String(result.replay) },
        });
    } catch (error) {
        if (error instanceof IdempotencyConflictError) {
            return NextResponse.json({ error: error.message }, { status: 409 });
        }
        console.error('Error creating deal.');
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
