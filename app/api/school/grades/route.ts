import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';
import {
    createMutationFingerprint,
    IdempotencyConflictError,
    readIdempotencyKey,
    runIdempotentCreate,
} from '@/lib/server-idempotency';

const createGradeSchema = z.object({
    courseId: z.string().min(1).max(200),
    name: z.string().min(1).max(500),
    score: z.number().min(0),
    maxScore: z.number().min(1),
    weight: z.number().min(0).max(100),
    category: z.string().min(1).max(100),
    date: z.string().min(1).max(100),
});

// POST /api/school/grades - Create new grade
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
        const parsed = createGradeSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const { courseId, name, score, maxScore, weight, category, date } = parsed.data;

        // Verify course belongs to user
        const course = await prisma.course.findFirst({
            where: {
                id: courseId,
                userId: user.id,
            },
        });

        if (!course) {
            return NextResponse.json({ error: 'Course not found' }, { status: 404 });
        }

        const { key: idempotencyKey, invalid } = readIdempotencyKey(request);
        if (invalid) return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 });

        const gradeData = {
            userId: user.id,
            courseId,
            name,
            score,
            maxScore,
            weight,
            category,
            date: new Date(date),
        };
        const result = await runIdempotentCreate(prisma, {
            userId: user.id,
            scope: 'school_grade_create',
            idempotencyKey,
            fingerprint: createMutationFingerprint(parsed.data),
            resourceType: 'grade',
            create: (db) => db.grade.create({ data: gradeData }),
            findResource: (resourceId, db) => db.grade.findFirst({
                where: { id: resourceId, userId: user.id },
            }),
        });

        return NextResponse.json(result.resource, {
            status: result.replay ? 200 : 201,
            headers: { 'X-Idempotent-Replay': String(result.replay) },
        });
    } catch (error) {
        if (error instanceof IdempotencyConflictError) {
            return NextResponse.json({ error: error.message }, { status: 409 });
        }
        console.error('Error creating grade.');
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
