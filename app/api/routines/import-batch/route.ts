import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
        const { routines, trackers, checklists, planning } = body;

        const results = await prisma.$transaction(async (tx) => {
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
                            userId: user.id,
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
                        userId: user.id,
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
                            userId: user.id,
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
                            userId: user.id,
                            source: 'routine',
                        },
                    });
                    createdChecklists.push(checklist);
                }
            }

            return { routines: createdRoutines, trackers: createdTrackers, checklists: createdChecklists };
        });

        return NextResponse.json(results);
    } catch (error) {
        console.error('[Import Batch] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
