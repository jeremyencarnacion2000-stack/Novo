/// <reference types="jest" />
import { executeAIAction } from '../executor';
import { prisma } from '@/lib/prisma';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
    prisma: {
        routine: {
            create: jest.fn(),
            update: jest.fn(),
            findUnique: jest.fn(),
            findMany: jest.fn(),
        },
        workoutLog: {
            create: jest.fn(),
            update: jest.fn(),
            findUnique: jest.fn(),
            count: jest.fn(),
        },
        task: {
            create: jest.fn(),
            update: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
        },
        quickNote: {
            create: jest.fn(),
            update: jest.fn(),
            findMany: jest.fn(),
        },
    },
}));

describe('AI Executor', () => {
    const userId = 'test-user';

    beforeEach(() => {
        jest.clearAllMocks();
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

        (prisma.routine.findUnique as jest.Mock).mockResolvedValue({ id: 'routine-1', name: 'Test Routine' });
        (prisma.workoutLog.create as jest.Mock).mockResolvedValue({ id: 'log-1' });

        const result = await executeAIAction(action as any, userId);

        expect(result.success).toBe(true);
        expect(prisma.workoutLog.create).toHaveBeenCalled();
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
        expect(result.error).toContain('No handler registered');
    });
});
