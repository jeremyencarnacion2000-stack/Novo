import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

const stepsSchema = z.object({
    steps: z.number().finite().int().min(0).max(2_000_000),
    date: z.string().datetime().optional(),
});

const STEPS_SCOPE = 'fitness_steps_upsert';

function isUniqueConstraint(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

function replayResponse(entry: unknown) {
    const response = NextResponse.json({ success: true, message: 'Steps already logged', data: entry });
    response.headers.set('X-Idempotent-Replay', 'true');
    return response;
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const parsed = stepsSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid steps value' }, { status: 400 });
        }

        const { steps, date } = parsed.data;
        const entryDate = date ? new Date(date) : new Date();
        entryDate.setHours(0, 0, 0, 0);
        const nextDate = new Date(entryDate.getTime() + 24 * 60 * 60 * 1000);
        const idempotencyKey = request.headers.get('Idempotency-Key')?.trim() || null;
        if (request.headers.has('Idempotency-Key') && (!idempotencyKey || idempotencyKey.length > 128)) {
            return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 });
        }
        const fingerprint = JSON.stringify({ steps, date: entryDate.toISOString() });

        if (idempotencyKey) {
            const existingMutation = await prisma.mutationRequest.findUnique({
                where: { userId_scope_idempotencyKey: { userId: session.user.id, scope: STEPS_SCOPE, idempotencyKey } },
            });
            if (existingMutation) {
                if (existingMutation.fingerprint !== fingerprint) {
                    return NextResponse.json({ error: 'Idempotency key was already used for another request' }, { status: 409 });
                }
                const existingEntry = await prisma.fitnessEntry.findFirst({ where: { id: existingMutation.resourceId, userId: session.user.id } });
                if (existingEntry) return replayResponse(existingEntry);
            }
        }

        let entry;
        try {
            entry = await prisma.$transaction(async (tx) => {
                const existing = await tx.fitnessEntry.findFirst({
                    where: { userId: session.user.id, date: { gte: entryDate, lt: nextDate } },
                });
                const saved = existing
                    ? await tx.fitnessEntry.update({ where: { id: existing.id }, data: { steps } })
                    : await tx.fitnessEntry.create({ data: { userId: session.user.id, steps, date: entryDate } });
                if (idempotencyKey) {
                    await tx.mutationRequest.create({
                        data: { userId: session.user.id, scope: STEPS_SCOPE, idempotencyKey, fingerprint, resourceType: 'fitness_entry', resourceId: saved.id },
                    });
                }
                return saved;
            });
        } catch (error) {
            if (idempotencyKey && isUniqueConstraint(error)) {
                const winner = await prisma.mutationRequest.findUnique({
                    where: { userId_scope_idempotencyKey: { userId: session.user.id, scope: STEPS_SCOPE, idempotencyKey } },
                });
                if (winner && winner.fingerprint !== fingerprint) {
                    return NextResponse.json({ error: 'Idempotency key was already used for another request' }, { status: 409 });
                }
                if (winner) {
                    const existingEntry = await prisma.fitnessEntry.findFirst({ where: { id: winner.resourceId, userId: session.user.id } });
                    if (existingEntry) return replayResponse(existingEntry);
                }
            }
            throw error;
        }

        const response = NextResponse.json({
            success: true,
            message: 'Steps logged successfully',
            data: entry,
        });
        response.headers.set('X-Idempotent-Replay', 'false');
        return response;
    } catch {
        console.error('Error logging steps.');
        return NextResponse.json({ error: 'Failed to log steps' }, { status: 500 });
    }
}
