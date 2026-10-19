/// <reference types="jest" />
import { executeAIAction } from '../executor';
import { prisma } from '@/lib/prisma';
import { gmailService } from '@/lib/google';

// Mock Google (executor.ts pulls this in for CREATE_EVENT's best-effort push
// sync — mocked the same way other suites touching @/lib/google do, so this
// test file doesn't drag next-auth's OAuth client chain into jsdom, which
// crashes on missing TextEncoder). No token => sync is skipped silently.
jest.mock('@/lib/google', () => ({
    calendarService: { createEvent: jest.fn(), listEvents: jest.fn() },
    gmailService: { sendEmail: jest.fn(), listUnread: jest.fn(), sendEmailForUser: jest.fn(), findSentForUser: jest.fn() },
    getGoogleAccessToken: jest.fn().mockResolvedValue(null),
}));

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
    prisma: {
        routine: {
            create: jest.fn(),
            update: jest.fn(),
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
        },
        course: {
            findFirst: jest.fn(),
        },
        grade: {
            create: jest.fn(),
            findFirst: jest.fn(),
        },
        workoutLog: {
            create: jest.fn(),
            update: jest.fn(),
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            count: jest.fn(),
        },
        task: {
            create: jest.fn(),
            update: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
        },
        calendarEvent: {
            create: jest.fn(),
            update: jest.fn(),
            findFirst: jest.fn(),
        },
        quickNote: {
            create: jest.fn(),
            update: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
        },
        // Consulted by checkFreePlanLimit (gate) — undefined return => not 'free' => no gate.
        user: {
            findUnique: jest.fn(),
        },
        // Best-effort audit log written after every action.
        aiActionLog: {
            create: jest.fn(),
            count: jest.fn(),
        },
    },
}));

describe('AI Executor', () => {
    const userId = 'test-user';

    beforeEach(() => {
        jest.clearAllMocks();
        // The idempotency boundary is only exercised by the focused retry
        // tests below; keeping it opt-in preserves the lightweight legacy
        // mocks used by the rest of this suite.
        (prisma as any).mutationRequest = {
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        };
        (prisma as any).$transaction = jest.fn(async (callback: (tx: any) => Promise<unknown>) => callback(prisma as any));
    });

    it('should create a routine', async () => {
        const action = {
            type: 'CREATE_ROUTINE',
            payload: {
                name: 'Test Routine',
                description: 'Desc',
                daysOfWeek: ['monday'],
                exercises: []
            }
        };

        (prisma.routine.create as jest.Mock).mockResolvedValue({ id: 'routine-1', name: 'Test Routine' });

        const result = await executeAIAction(action as any, userId);

        expect(result.success).toBe(true);
        expect(prisma.routine.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                name: 'Test Routine',
                userId
            })
        }));
    });

    it('should start a workout', async () => {
        const action = {
            type: 'START_WORKOUT',
            payload: { routineId: 'routine-1' }
        };

        // ID-ownership verification uses findFirst; the handler then reads via findUnique.
        (prisma.routine.findFirst as jest.Mock).mockResolvedValue({ id: 'routine-1', name: 'Test Routine' });
        (prisma.routine.findUnique as jest.Mock).mockResolvedValue({ id: 'routine-1', name: 'Test Routine' });
        (prisma.workoutLog.create as jest.Mock).mockResolvedValue({ id: 'log-1' });

        const result = await executeAIAction(action as any, userId);

        expect(result.success).toBe(true);
        expect(prisma.workoutLog.create).toHaveBeenCalled();
    });

    it('replays a START_WORKOUT intent instead of creating a second log', async () => {
        const key = 'workout-start-intent';
        const mutationRequest = (prisma as any).mutationRequest;
        const createdLog = { id: 'log-replay', routineId: 'routine-1' };
        mutationRequest.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
            fingerprint: JSON.stringify({ routineId: 'routine-1' }),
            resourceId: createdLog.id,
        });
        (prisma.routine.findFirst as jest.Mock).mockResolvedValue({ id: 'routine-1', name: 'Test Routine' });
        (prisma.routine.findUnique as jest.Mock).mockResolvedValue({ id: 'routine-1', name: 'Test Routine' });
        (prisma.workoutLog.create as jest.Mock).mockResolvedValue(createdLog);
        (prisma.workoutLog.findFirst as jest.Mock).mockResolvedValue(createdLog);

        await executeAIAction({ type: 'START_WORKOUT', payload: { routineId: 'routine-1' } } as any, userId, undefined, key);
        const replay = await executeAIAction({ type: 'START_WORKOUT', payload: { routineId: 'routine-1' } } as any, userId, undefined, key);

        expect(replay.success).toBe(true);
        expect(prisma.workoutLog.create).toHaveBeenCalledTimes(1);
        expect(prisma.workoutLog.findFirst).toHaveBeenCalledWith({
            where: { id: createdLog.id, routine: { userId } },
        });
    });

    it('replays a day-plan task when a model retry changes its wording', async () => {
        const key = 'day-plan:user:onboarding:2026-09-17';
        const mutationRequest = (prisma as any).mutationRequest;
        const createdTask = { id: 'task-day-plan', title: 'Plan original' };
        mutationRequest.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
            fingerprint: JSON.stringify({ index: 0 }),
            resourceId: createdTask.id,
        });
        (prisma.task.create as jest.Mock).mockResolvedValue(createdTask);
        (prisma.task.findFirst as jest.Mock).mockResolvedValue(createdTask);

        await executeAIAction({
            type: 'CREATE_TASKS',
            payload: { tasks: [{ title: 'Plan original', category: 'Work', priority: 3 }] },
        } as any, userId, undefined, key);
        const replay = await executeAIAction({
            type: 'CREATE_TASKS',
            payload: { tasks: [{ title: 'Plan reformulado por el modelo', category: 'Work', priority: 1 }] },
        } as any, userId, undefined, key);

        expect(replay.success).toBe(true);
        expect(prisma.task.create).toHaveBeenCalledTimes(1);
        expect(prisma.task.findFirst).toHaveBeenCalledWith({ where: { id: createdTask.id, userId } });
    });

    it('replays a day-plan event when a model retry changes its wording', async () => {
        const key = 'day-plan:user:onboarding:2026-09-17';
        const mutationRequest = (prisma as any).mutationRequest;
        const createdEvent = {
            id: 'event-day-plan',
            title: 'Bloque original',
            start: new Date('2026-09-18T09:00:00.000Z'),
            end: new Date('2026-09-18T10:00:00.000Z'),
        };
        mutationRequest.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
            fingerprint: JSON.stringify({ dayPlan: true }),
            resourceId: createdEvent.id,
        });
        (prisma.calendarEvent.create as jest.Mock).mockResolvedValue(createdEvent);
        (prisma.calendarEvent.findFirst as jest.Mock).mockResolvedValue(createdEvent);

        await executeAIAction({
            type: 'CREATE_EVENT',
            payload: {
                title: 'Bloque original',
                description: 'Trabajo profundo',
                start: '2026-09-18T09:00:00.000Z',
                end: '2026-09-18T10:00:00.000Z',
                allDay: false,
            },
        } as any, userId, undefined, key);
        const replay = await executeAIAction({
            type: 'CREATE_EVENT',
            payload: {
                title: 'Bloque reformulado por el modelo',
                description: 'Mismo bloque con otra descripción',
                start: '2026-09-18T09:00:00.000Z',
                end: '2026-09-18T10:00:00.000Z',
                allDay: false,
            },
        } as any, userId, undefined, key);

        expect(replay.success).toBe(true);
        expect(prisma.calendarEvent.create).toHaveBeenCalledTimes(1);
        expect(prisma.calendarEvent.findFirst).toHaveBeenCalledWith({ where: { id: createdEvent.id, userId } });
    });

    it('replays an ADD_GRADE intent instead of duplicating the grade', async () => {
        const key = 'grade-create-intent';
        const mutationRequest = (prisma as any).mutationRequest;
        const grade = { id: 'grade-replay', courseId: 'course-1', name: 'Midterm' };
        const fingerprint = JSON.stringify({
            category: 'Exam',
            courseId: 'course-1',
            date: '2026-09-17',
            maxScore: 100,
            name: 'Midterm',
            score: 90,
            weight: 20,
        });
        mutationRequest.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ fingerprint, resourceId: grade.id });
        (prisma.course.findFirst as jest.Mock).mockResolvedValue({ id: 'course-1' });
        (prisma.grade.create as jest.Mock).mockResolvedValue(grade);
        (prisma.grade.findFirst as jest.Mock).mockResolvedValue(grade);
        const action = {
            type: 'ADD_GRADE',
            payload: { courseId: 'course-1', name: 'Midterm', score: 90, maxScore: 100, weight: 20, category: 'Exam', date: '2026-09-17' },
        };

        await executeAIAction(action as any, userId, undefined, key);
        const replay = await executeAIAction(action as any, userId, undefined, key);

        expect(replay.success).toBe(true);
        expect(prisma.grade.create).toHaveBeenCalledTimes(1);
        expect(prisma.grade.findFirst).toHaveBeenCalledWith({ where: { id: grade.id, userId } });
    });

    it('should analyze progress', async () => {
        const action = {
            type: 'ANALYZE_PROGRESS',
            payload: { period: 'week' }
        };

        (prisma.workoutLog.count as jest.Mock).mockResolvedValue(5);
        (prisma.task.count as jest.Mock).mockResolvedValue(12);

        const result = await executeAIAction(action as any, userId);

        expect(result.success).toBe(true);
        expect(result.data.summary).toContain('5 workouts');
        expect(result.data.summary).toContain('12 tasks');
        expect(result.metadata).toBeDefined();
        expect(result.metadata?.executionTime).toBeDefined();
    });

    it('should handle system query', async () => {
        const action = {
            type: 'SYSTEM_QUERY',
            payload: { entity: 'tasks' }
        };

        (prisma.task.findMany as jest.Mock).mockResolvedValue([{ id: 'task-1' }]);

        const result = await executeAIAction(action as any, userId);

        expect(result.success).toBe(true);
        expect(prisma.task.findMany).toHaveBeenCalledWith({ where: { userId } });
    });

    it('should return error for unknown action', async () => {
        const action = {
            type: 'UNKNOWN_ACTION',
            payload: {}
        };

        const result = await executeAIAction(action as any, userId);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid action');
    });

    // Regression: ISSUE — GENERATE_FILE shipped a literal "El archivo
    // \"undefined\" se ha generado correctamente." chat bubble in production.
    // Root cause: the rescue model (used when the primary model hits its
    // rate limit) hallucinated the literal string "undefined" for a field it
    // should have left out. That's a real, non-empty string, so it passed
    // the old `!filename` truthy check and shipped verbatim instead of
    // falling back to a generated name. Found by /qa on 2026-07-19.
    describe('GENERATE_FILE hallucinated-placeholder guard', () => {
        it('falls back to a generated filename when the model hallucinates the literal string "undefined"', async () => {
            const action = {
                type: 'GENERATE_FILE',
                payload: { filename: 'undefined', content: 'contenido real', mimeType: 'text/plain' },
            };

            const result = await executeAIAction(action as any, userId);

            expect(result.success).toBe(true);
            expect(result.data.filename).not.toBe('undefined');
            expect(result.message).not.toContain('"undefined"');
        });

        it('falls back to a generated filename for "null" the same way', async () => {
            const action = {
                type: 'GENERATE_FILE',
                payload: { filename: 'null', content: 'contenido real', mimeType: 'text/plain' },
            };

            const result = await executeAIAction(action as any, userId);

            expect(result.data.filename).not.toBe('null');
        });

        it('keeps a real filename unchanged', async () => {
            const action = {
                type: 'GENERATE_FILE',
                payload: { filename: 'reporte.txt', content: 'contenido real', mimeType: 'text/plain' },
            };

            const result = await executeAIAction(action as any, userId);

            expect(result.data.filename).toBe('reporte.txt');
            expect(result.message).toContain('reporte.txt');
        });

        it('does not leak a hallucinated "undefined" content into the generated file', async () => {
            const action = {
                type: 'GENERATE_FILE',
                payload: { filename: 'notas.txt', content: 'undefined', mimeType: 'text/plain' },
            };

            const result = await executeAIAction(action as any, userId);

            // Content should hit the last-resort fallback text, not the
            // literal word "undefined" as the entire file body.
            expect(result.data.content).not.toBe('undefined');
        });
    });

    // Same vulnerability class as GENERATE_FILE, found while auditing the
    // other handlers for it on 2026-07-19: CREATE_TASK wrote whatever the
    // model sent for `title` straight into the database and back out into
    // the chat bubble with no guard, so a hallucinated "undefined" would
    // have created a real task literally named "undefined".
    describe('dropHallucinatedPlaceholder guard on CREATE_TASK', () => {
        it('falls back to a real title when the model hallucinates "undefined"', async () => {
            (prisma.task.create as jest.Mock).mockResolvedValue({ id: 'task-1', title: 'Tarea sin título' });

            const result = await executeAIAction({
                type: 'CREATE_TASK',
                payload: { title: 'undefined', priority: 'medium' },
            } as any, userId);

            expect(result.success).toBe(true);
            expect(prisma.task.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ title: 'Tarea sin título' }),
            }));
            expect(result.message).not.toContain('"undefined"');
        });

        it('keeps a real title unchanged', async () => {
            (prisma.task.create as jest.Mock).mockResolvedValue({ id: 'task-2', title: 'Comprar leche' });

            await executeAIAction({
                type: 'CREATE_TASK',
                payload: { title: 'Comprar leche', priority: 'low' },
            } as any, userId);

            expect(prisma.task.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ title: 'Comprar leche' }),
            }));
        });

        it('persists only sanitized audit metadata, never private task content', async () => {
            (prisma.task.create as jest.Mock).mockResolvedValue({ id: 'task-private', title: 'Preparar propuesta confidencial' });

            await executeAIAction({
                type: 'CREATE_TASK',
                payload: { title: 'Preparar propuesta confidencial', description: 'Notas privadas que no deben entrar en auditoría', priority: 'high' },
            } as any, userId);

            const auditWrite = (prisma.aiActionLog.create as jest.Mock).mock.calls.at(-1)?.[0]?.data
            expect(auditWrite.payload).toBe(JSON.stringify({ fieldNames: ['description', 'priority', 'title'] }))
            expect(auditWrite.payload).not.toContain('confidencial')
            expect(auditWrite.payload).not.toContain('privadas')
        });
    });

    // SEND_EMAIL is irreversible and externally visible, so unlike the
    // graceful "Tarea sin título" fallback above, a hallucinated field here
    // must block the send rather than mail a placeholder.
    describe('dropHallucinatedPlaceholder guard on SEND_EMAIL', () => {
        it('accepts the real confirmation envelope and sends through the owner grant', async () => {
            (gmailService.sendEmailForUser as jest.Mock).mockResolvedValue({ id: 'sent123' });
            const result = await executeAIAction({ type: 'SEND_EMAIL', payload: { to: 'a@b.test', subject: 'Revisado', body: 'Hola', confirmed: true } } as any, userId, prisma, 'reviewed-intent');
            expect(result.success).toBe(true);
            expect(gmailService.sendEmailForUser).toHaveBeenCalledWith(userId, expect.objectContaining({ to: 'a@b.test', body: 'Hola' }), expect.any(String));
        });
        it('requires an explicit review confirmation for external delivery', async () => {
            const result = await executeAIAction({ type: 'SEND_EMAIL', payload: { to: 'a@b.test', subject: 'Revisado', body: 'Hola' } } as any, userId, prisma, 'unconfirmed-intent');
            expect(result.success).toBe(false);
            expect(gmailService.sendEmailForUser).not.toHaveBeenCalled();
        });
        it('refuses to send when the subject is a hallucinated "undefined"', async () => {
            const result = await executeAIAction({
                type: 'SEND_EMAIL',
                payload: { to: 'a@b.com', subject: 'undefined', body: 'Hola' },
            } as any, userId);

            expect(result.success).toBe(false);
        });
    });
});
