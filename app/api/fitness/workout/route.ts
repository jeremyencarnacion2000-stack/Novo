import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

const workoutSchema = z.object({
    name: z.string().trim().min(1).max(120),
    durationMinutes: z.number().finite().positive().max(24 * 60),
    date: z.string().datetime().optional(),
});

const WORKOUT_SCOPE = 'workout_create';

function isUniqueConstraint(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body: unknown = await request.json().catch(() => null);
        const parsed = workoutSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid workout details' }, { status: 400 });
        }
        const { name, durationMinutes, date } = parsed.data;
        const workoutDate = date ? new Date(date) : new Date();
        const idempotencyKey = request.headers.get('Idempotency-Key')?.trim() || null;
        if (request.headers.has('Idempotency-Key') && (!idempotencyKey || idempotencyKey.length > 128)) {
            return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 });
        }
        const fingerprint = JSON.stringify({ name, durationMinutes, date: date ?? null });

        if (idempotencyKey) {
            const existingMutation = await prisma.mutationRequest.findUnique({
                where: { userId_scope_idempotencyKey: { userId: session.user.id, scope: WORKOUT_SCOPE, idempotencyKey } },
            });
            if (existingMutation) {
                if (existingMutation.fingerprint !== fingerprint) {
                    return NextResponse.json({ error: 'Idempotency key was already used for another request' }, { status: 409 });
                }
                const existingWorkout = await prisma.workoutEntry.findFirst({ where: { id: existingMutation.resourceId, userId: session.user.id } });
                if (existingWorkout) {
                    const response = NextResponse.json({ success: true, message: 'Workout already logged', data: existingWorkout });
                    response.headers.set('X-Idempotent-Replay', 'true');
                    return response;
                }
            }
        }

        let workout;
        try {
            workout = await prisma.$transaction(async (tx) => {
                const created = await tx.workoutEntry.create({ data: { userId: session.user.id, name, durationMinutes, date: workoutDate } });
                if (idempotencyKey) {
                    await tx.mutationRequest.create({
                        data: { userId: session.user.id, scope: WORKOUT_SCOPE, idempotencyKey, fingerprint, resourceType: 'workout', resourceId: created.id },
                    });
                }
                return created;
            });
        } catch (error) {
            if (idempotencyKey && isUniqueConstraint(error)) {
                const winner = await prisma.mutationRequest.findUnique({
                    where: { userId_scope_idempotencyKey: { userId: session.user.id, scope: WORKOUT_SCOPE, idempotencyKey } },
                });
                if (winner && winner.fingerprint !== fingerprint) {
                    return NextResponse.json({ error: 'Idempotency key was already used for another request' }, { status: 409 });
                }
                if (winner?.fingerprint === fingerprint) {
                    const existingWorkout = await prisma.workoutEntry.findFirst({ where: { id: winner.resourceId, userId: session.user.id } });
                    if (existingWorkout) {
                        const response = NextResponse.json({ success: true, message: 'Workout already logged', data: existingWorkout });
                        response.headers.set('X-Idempotent-Replay', 'true');
                        return response;
                    }
                }
            }
            throw error;
        }

        const response = NextResponse.json({
            success: true,
            message: 'Workout logged successfully',
            data: workout
        });
        response.headers.set('X-Idempotent-Replay', 'false');
        return response;
    } catch {
        // Keep provider/database diagnostics out of the client response and
        // logs. The workout form only needs a safe retryable failure state.
        console.error('Error logging workout.');
        return NextResponse.json({
            error: 'Failed to log workout'
        }, { status: 500 });
    }
}
