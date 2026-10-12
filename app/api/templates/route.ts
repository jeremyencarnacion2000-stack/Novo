import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
    createMutationFingerprint,
    IdempotencyConflictError,
    readIdempotencyKey,
    runIdempotentCreate,
} from '@/lib/server-idempotency';

const templateCreateSchema = z.object({
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(2000).nullable().optional(),
    type: z.string().trim().min(1).max(64),
    category: z.string().trim().max(80).nullable().optional(),
    content: z.any(),
    isPublic: z.boolean().optional().default(false),
}).strict();

// GET /api/templates - Get all templates
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
        const type = searchParams.get('type');
        const category = searchParams.get('category');
        const includePublic = searchParams.get('includePublic') === 'true';

        // Build where clause
        const where: any = includePublic
            ? { OR: [{ userId: user.id }, { isPublic: true }] }
            : { userId: user.id };

        if (type) where.type = type;
        if (category) where.category = category;

        const templates = await prisma.template.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        return NextResponse.json({ templates });
    } catch (error) {
        console.error('Error fetching templates.');
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// POST /api/templates - Create a template
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const parsed = templateCreateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
        }

        const { key: idempotencyKey, invalid } = readIdempotencyKey(request);
        if (invalid) {
            return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 });
        }

        const input = parsed.data;
        const data = {
            name: input.name,
            description: input.description ?? null,
            type: input.type,
            category: input.category ?? null,
            content: input.content as Prisma.InputJsonValue,
            isPublic: input.isPublic,
            userId: session.user.id,
        };
        const fingerprint = createMutationFingerprint({
            name: input.name,
            description: input.description ?? null,
            type: input.type,
            category: input.category ?? null,
            content: input.content,
            isPublic: input.isPublic,
        });

        const result = await runIdempotentCreate(prisma, {
            userId: session.user.id,
            scope: 'template_create',
            idempotencyKey,
            fingerprint,
            resourceType: 'template',
            create: (db) => db.template.create({ data }),
            findResource: (resourceId, db) => db.template.findFirst({
                where: { id: resourceId, userId: session.user.id },
            }),
        });

        const response = NextResponse.json(
            { template: result.resource },
            { status: result.replay ? 200 : 201 },
        );
        response.headers.set('X-Idempotent-Replay', String(result.replay));
        return response;
    } catch (error) {
        if (error instanceof IdempotencyConflictError) {
            return NextResponse.json({ error: error.message }, { status: 409 });
        }

        if (error instanceof SyntaxError) {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        console.error('Error creating template.');
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
