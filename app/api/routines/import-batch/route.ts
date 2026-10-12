import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createMutationFingerprint, readIdempotencyKey } from '@/lib/server-idempotency';
import { z } from 'zod';

const importBatchSchema = z.object({
    routines: z.array(z.record(z.string(), z.any())).max(50).default([]),
    trackers: z.array(z.record(z.string(), z.any())).max(50).default([]),
    checklists: z.array(z.record(z.string(), z.any())).max(100).default([]),
    planning: z.record(z.string(), z.any()).nullable().optional().default(null),
}).strict();

const IMPORT_BATCH_SCOPE = 'routine_import_batch';

function isUniqueConstraintError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const parsed = importBatchSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
        }

        const { key: idempotencyKey, invalid: invalidIdempotencyKey } = readIdempotencyKey(request);
        if (invalidIdempotencyKey) {
            return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 });
        }

        const { routines, trackers, checklists, planning } = parsed.data;
        const fingerprint = createMutationFingerprint({ routines, trackers, checklists, planning });
        const mutationWhere = idempotencyKey
            ? {
                userId_scope_idempotencyKey: {
                    userId: session.user.id,
                    scope: IMPORT_BATCH_SCOPE,
                    idempotencyKey,
                },
            }
            : null;

        if (mutationWhere) {
            const existing = await prisma.mutationRequest.findUnique({ where: mutationWhere });
            if (existing) {
                if (existing.fingerprint !== fingerprint) {
                    return NextResponse.json({ error: 'Idempotency key was already used for another import' }, { status: 409 });
                }
                return NextResponse.json(
                    { success: true, replay: true },
                    { status: 200, headers: { 'X-Idempotent-Replay': 'true' } },
                );
            }
        }

        const createImport = async (tx: any) => {
            if (mutationWhere) {
                await tx.mutationRequest.create({
                    data: {
                        userId: session.user.id,
                        scope: IMPORT_BATCH_SCOPE,
                        idempotencyKey,
                        fingerprint,
                        resourceType: 'routine_import_batch',
                        resourceId: 'pending',
                    },
                });
            }

            const createdRoutines = [];
            const createdTrackers = [];
            const createdChecklists = [];

            // 1. Import Routines
            if (routines && routines.length > 0) {
                for (const r of routines) {
                    // Prepare days: if r.days exists, use it. If not, but r.exercises exists, create a default day.
                    let daysToCreate = r.days || [];
                    if (daysToCreate.length === 0 && r.exercises && r.exercises.length > 0) {
                        daysToCreate = [{
                            name: 'General',
                            order: 0,
                            exercises: r.exercises
                        }];
                    }

                    const routine = await tx.routine.create({
                        data: {
                            name: r.name,
                            description: r.description || '',
                            timeOfDay: r.timeOfDay || 'anytime',
                            duration: r.duration || 30,
                            frequency: r.frequency,
                            level: r.level,
                            tempo: r.tempo,
                            method: r.method,
                            userId: session.user.id,
                            days: {
                                create: daysToCreate.map((day: any, dIdx: number) => ({
                                    name: day.name || `Día ${dIdx + 1}`,
                                    weekday: day.weekday,
                                    order: day.order ?? dIdx,
                                    exercises: {
                                        create: (day.exercises || []).map((ex: any, eIdx: number) => ({
                                            name: ex.name,
                                            muscleGroup: ex.muscleGroup || 'Other',
                                            sets: parseInt(ex.sets) || 3,
                                            reps: String(ex.reps || '10-12'),
                                            notes: ex.notes,
                                            order: eIdx,
                                        })),
                                    },
                                })),
                            },
                        },
                    });
                    createdRoutines.push(routine);
                }
            }

            // 2. Import Planning as a special routine or tasks
            if (planning) {
                const planningRoutine = await tx.routine.create({
                    data: {
                        name: planning.title || 'Planificación Diaria',
                        description: 'Planificación importada de documento',
                        timeOfDay: 'anytime',
                        duration: 0,
                        userId: session.user.id,
                        tasks: {
                            create: (planning.schedule || []).map((item: any) => ({
                                text: `${item.time}: ${item.activity}${item.notes ? ` (${item.notes})` : ''}`,
                                completed: false,
                            })),
                        },
                    },
                });
                createdRoutines.push(planningRoutine);
            }

            // 3. Import Trackers
            if (trackers && trackers.length > 0) {
                for (const t of trackers) {
                    const tracker = await tx.tracker.create({
                        data: {
                            name: t.name,
                            type: t.type || 'habit',
                            unit: t.unit || 'reps',
                            goal: parseFloat(t.goal) || 1,
                            userId: session.user.id,
                        },
                    });
                    createdTrackers.push(tracker);
                }
            }

            // 4. Import Checklists
            if (checklists && checklists.length > 0) {
                for (const c of checklists) {
                    const checklist = await tx.checklistItem.create({
                        data: {
                            text: c.text,
                            priority: 'medium',
                            userId: session.user.id,
                            source: 'routine',
                        },
                    });
                    createdChecklists.push(checklist);
                }
            }

            const results = { routines: createdRoutines, trackers: createdTrackers, checklists: createdChecklists };
            if (mutationWhere) {
                await tx.mutationRequest.update({
                    where: mutationWhere,
                    data: { resourceId: 'completed' },
                });
            }
            return results;
        };

        let results;
        try {
            results = await prisma.$transaction(createImport);
        } catch (error) {
            // A concurrent retry can win the unique MutationRequest race. The
            // winner's transaction contains every child write, so returning a
            // replay here is safe even though this endpoint does not need to
            // return the imported IDs to the caller.
            if (mutationWhere && isUniqueConstraintError(error)) {
                const winner = await prisma.mutationRequest.findUnique({ where: mutationWhere });
                if (winner?.fingerprint === fingerprint && winner.resourceId === 'completed') {
                    return NextResponse.json(
                        { success: true, replay: true },
                        { status: 200, headers: { 'X-Idempotent-Replay': 'true' } },
                    );
                }
                if (winner && winner.fingerprint !== fingerprint) {
                    return NextResponse.json({ error: 'Idempotency key was already used for another import' }, { status: 409 });
                }
            }
            throw error;
        }

        return NextResponse.json(
            results,
            { status: 201, headers: { 'X-Idempotent-Replay': 'false' } },
        );
    } catch (error) {
        if (error instanceof SyntaxError) {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }
        console.error('[Import Batch] Error.');
        return NextResponse.json(
            { error: 'Unable to import routines right now' },
            { status: 500 }
        );
    }
}
