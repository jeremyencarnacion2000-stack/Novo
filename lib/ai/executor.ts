import { prisma } from '@/lib/prisma';
import {
    AIAction,
    AIActionType,
    CreateRoutineAction,
    UpdateRoutineAction,
    DeleteRoutineAction,
    StartWorkoutAction,
    FinishWorkoutAction,
    CreateTaskAction,
    UpdateTaskAction,
    DeleteTaskAction,
    CreateNoteAction,
    UpdateNoteAction,
    AnalyzeProgressAction,
    SystemQueryAction
} from './actions';
import { ACTION_PERMISSIONS, AIPermission } from './permissions';

// --- Interfaces ---

export interface AIActionResult<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    confirmationRequired?: boolean;
    message?: string;
    metadata?: {
        executionTime?: number;
        [key: string]: any;
    };
}

export interface ExecutionContext {
    userId: string;
    prisma: typeof prisma;
    // Add other context items here (e.g., logger, analytics)
}

type ActionHandler<T extends AIAction = AIAction> = (
    action: T,
    context: ExecutionContext
) => Promise<AIActionResult>;

// --- Registry ---

const actionRegistry: Partial<Record<AIActionType, ActionHandler<any>>> = {};

export function registerActionHandler<T extends AIAction>(
    type: AIActionType,
    handler: ActionHandler<T>
) {
    actionRegistry[type] = handler;
}

// --- Executor ---

export async function executeAIAction(
    action: AIAction,
    userId: string,
    prismaClient: typeof prisma = prisma
): Promise<AIActionResult> {
    const startTime = Date.now();
    console.log(`[AI Executor] Executing action: ${action.type} for user: ${userId}`);

    const context: ExecutionContext = {
        userId,
        prisma: prismaClient,
    };

    console.log(`[AI Executor] Context: UserID=${userId}`);
    console.log(`[AI Executor] Action Payload:`, JSON.stringify(action.payload, null, 2));

    try {
        const actionType = action.type || (action as any).name;
        const handler = actionRegistry[actionType as AIActionType];

        if (!handler) {
            const validActions = Object.keys(actionRegistry).join(', ');
            return {
                success: false,
                error: `Invalid action: "${actionType}". Valid actions are: ${validActions}`,
            };
        }

        // Check permissions (Optional: could be moved to a middleware/decorator)
        // const requiredPermissions = ACTION_PERMISSIONS[action.type];
        // if (requiredPermissions) { ... check permissions ... }

        const result = await handler(action, context);
        console.log(`[AI Executor] Handler Result:`, JSON.stringify(result, null, 2));

        return {
            ...result,
            metadata: {
                ...result.metadata,
                executionTime: Date.now() - startTime,
            },
        };
    } catch (error) {
        console.error(`[AI Executor] Error executing ${action.type}:`, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown execution error',
            metadata: {
                executionTime: Date.now() - startTime,
            },
        };
    }
}

// --- Handlers Implementation ---

// Routines
registerActionHandler<CreateRoutineAction>('CREATE_ROUTINE', async (action, ctx) => {
    const { name, description, daysOfWeek, exercises } = action.payload;
    // Handle multi-day payload if present (custom logic needed if 'days' is in payload but not in type)
    // For now, we cast payload to any to access 'days' if it's not in the strict type yet, 
    // OR we should update the CreateRoutineAction type. 
    // Let's assume we update the type or cast here.
    const payload = action.payload as any;
    const days = payload.days;

    if (!name) throw new Error("Routine name is required");

    // Construct the days data structure
    let daysData = [];

    if (days && Array.isArray(days)) {
        // Scenario 1: Multi-day routine provided by AI
        daysData = days.map((day: any, dayIdx: number) => ({
            name: day.name || `Day ${dayIdx + 1}`,
            weekday: day.weekday,
            order: dayIdx,
            exercises: {
                create: (day.exercises || []).map((ex: any, exIdx: number) => ({
                    name: ex.name,
                    muscleGroup: ex.muscleGroup || 'General',
                    sets: ex.sets || 3,
                    reps: String(ex.reps || '10'),
                    order: exIdx,
                    notes: ex.notes
                }))
            }
        }));
    } else if (exercises && Array.isArray(exercises)) {
        // Scenario 2: Single-day/Flat routine (Legacy fallback)
        daysData = [{
            name: 'Day 1',
            order: 0,
            exercises: {
                create: exercises.map((ex: any, idx: number) => ({
                    name: ex.name,
                    muscleGroup: ex.muscleGroup || 'General',
                    sets: ex.sets || 3,
                    reps: String(ex.reps || '10'),
                    order: idx,
                    notes: ex.notes
                }))
            }
        }];
    } else {
        // Scenario 3: No exercises provided (Empty routine)
        daysData = [{ name: 'Day 1', order: 0, exercises: { create: [] } }];
    }

    const routine = await ctx.prisma.routine.create({
        data: {
            name,
            description: description || '',
            daysOfWeek: daysOfWeek ? JSON.stringify(daysOfWeek) : '[]',
            userId: ctx.userId,
            duration: 60,
            timeOfDay: 'anytime',
            days: {
                create: daysData
            },
        },
        include: { days: { include: { exercises: true } } },
    });
    return {
        success: true,
        data: routine,
        message: `Routine "${routine.name}" created with ${routine.days.length} days.`,
        metadata: {
            sectionName: 'Routines',
            redirectPath: '/routines'
        }
    };
});

registerActionHandler<UpdateRoutineAction>('UPDATE_ROUTINE', async (action, ctx) => {
    const { id, updates } = action.payload;
    const routine = await ctx.prisma.routine.update({
        where: { id, userId: ctx.userId },
        data: {
            ...updates,
            daysOfWeek: updates.daysOfWeek ? JSON.stringify(updates.daysOfWeek) : undefined,
        },
    });
    return { success: true, data: routine, message: `Routine updated.` };
});

registerActionHandler<DeleteRoutineAction>('DELETE_ROUTINE', async (action, ctx) => {
    return { success: false, confirmationRequired: true, message: "Are you sure you want to delete this routine?" };
});

// Workouts
registerActionHandler<StartWorkoutAction>('START_WORKOUT', async (action, ctx) => {
    const { routineId } = action.payload;
    const routine = await ctx.prisma.routine.findUnique({
        where: { id: routineId, userId: ctx.userId },
        include: { days: { include: { exercises: true } } },
    });

    if (!routine) throw new Error("Routine not found");

    const log = await ctx.prisma.workoutLog.create({
        data: {
            routineId,
            duration: 0,
            completed: false,
            date: new Date(),
        },
    });

    return {
        success: true,
        data: { workoutLogId: log.id, routine },
        message: `Workout started! Tracking log ID: ${log.id}`,
        metadata: {
            sectionName: 'Workouts',
            redirectPath: '/workouts'
        }
    };
});

registerActionHandler<FinishWorkoutAction>('FINISH_WORKOUT', async (action, ctx) => {
    const { workoutLogId, duration, exercises } = action.payload;
    const log = await ctx.prisma.workoutLog.findUnique({ where: { id: workoutLogId } });
    if (!log) throw new Error("Workout log not found");

    const updatedLog = await ctx.prisma.workoutLog.update({
        where: { id: workoutLogId },
        data: {
            duration,
            completed: true,
            exercises: {
                create: exercises.map((ex: any) => ({
                    exerciseName: ex.exerciseName,
                    setsDone: ex.setsDone,
                    repsDone: ex.repsDone,
                    weight: ex.weight,
                    notes: ex.notes,
                })),
            },
        },
        include: { exercises: true },
    });
    return { success: true, data: updatedLog, message: "Workout finished and logged successfully!" };
});

// Tasks
registerActionHandler<CreateTaskAction>('CREATE_TASK', async (action, ctx) => {
    const { title, category, priority, dueDate } = action.payload;
    const task = await ctx.prisma.task.create({
        data: {
            title,
            status: 'todo',
            priority: priority === 3 ? 'high' : priority === 2 ? 'medium' : 'low',
            dueDate,
            tags: JSON.stringify([category]),
            userId: ctx.userId,
        },
    });
    return {
        success: true,
        data: task,
        message: `Task "${task.title}" created.`,
        metadata: {
            sectionName: 'Tasks',
            redirectPath: '/tasks'
        }
    };
});

registerActionHandler<CreateTasksAction>('CREATE_TASKS', async (action, ctx) => {
    const { tasks } = action.payload;
    const createdTasks = await Promise.all(
        tasks.map(t => ctx.prisma.task.create({
            data: {
                title: t.title,
                status: 'todo',
                priority: t.priority === 3 ? 'high' : t.priority === 2 ? 'medium' : 'low',
                dueDate: t.dueDate,
                tags: JSON.stringify([t.category]),
                userId: ctx.userId,
            },
        }))
    );
    return {
        success: true,
        data: createdTasks,
        message: `${createdTasks.length} tasks created successfully.`,
        metadata: {
            sectionName: 'Tasks',
            redirectPath: '/tasks'
        }
    };
});

registerActionHandler<UpdateTaskAction>('UPDATE_TASK', async (action, ctx) => {
    const { id, updates } = action.payload;

    // Convert numeric priority to string if present
    let prismaUpdates: any = { ...updates };
    if (updates.priority !== undefined) {
        prismaUpdates.priority = updates.priority === 3 ? 'high' : updates.priority === 2 ? 'medium' : 'low';
    }

    const task = await ctx.prisma.task.update({
        where: { id, userId: ctx.userId },
        data: prismaUpdates,
    });
    return { success: true, data: task, message: `Task updated.` };
});

registerActionHandler<DeleteTaskAction>('DELETE_TASK', async (action, ctx) => {
    return { success: false, confirmationRequired: true, message: "Are you sure you want to delete this task?" };
});

// Projects
registerActionHandler<CreateProjectAction>('CREATE_PROJECT', async (action, ctx) => {
    const { title, description, status, priority, dueDate, tags } = action.payload;
    const project = await ctx.prisma.project.create({
        data: {
            title,
            description,
            status,
            priority,
            dueDate,
            tags: JSON.stringify(tags || []),
            userId: ctx.userId,
        },
    });
    return {
        success: true,
        data: project,
        message: `Project "${project.title}" created.`,
        metadata: {
            sectionName: 'Projects',
            redirectPath: '/projects'
        }
    };
});

registerActionHandler<UpdateProjectAction>('UPDATE_PROJECT', async (action, ctx) => {
    const { id, updates } = action.payload;
    const project = await ctx.prisma.project.update({
        where: { id, userId: ctx.userId },
        data: {
            ...updates,
            tags: updates.tags ? JSON.stringify(updates.tags) : undefined,
        },
    });
    return { success: true, data: project, message: `Project updated.` };
});

registerActionHandler<DeleteProjectAction>('DELETE_PROJECT', async (action, ctx) => {
    return { success: false, confirmationRequired: true, message: "Are you sure you want to delete this project?" };
});

// School
registerActionHandler<CreateCourseAction>('CREATE_COURSE', async (action, ctx) => {
    const { name, code, credits, semester, year, professor, color } = action.payload;
    const course = await ctx.prisma.course.create({
        data: {
            name,
            code,
            credits,
            semester,
            year,
            professor,
            color: color || '#3b82f6',
            userId: ctx.userId,
        },
    });
    return {
        success: true,
        data: course,
        message: `Course "${course.name}" created.`,
        metadata: {
            sectionName: 'School',
            redirectPath: '/school'
        }
    };
});

registerActionHandler<UpdateCourseAction>('UPDATE_COURSE', async (action, ctx) => {
    const { id, updates } = action.payload;
    const course = await ctx.prisma.course.update({
        where: { id, userId: ctx.userId },
        data: updates,
    });
    return { success: true, data: course, message: `Course updated.` };
});

registerActionHandler<DeleteCourseAction>('DELETE_COURSE', async (action, ctx) => {
    return { success: false, confirmationRequired: true, message: "Are you sure you want to delete this course?" };
});

registerActionHandler<AddGradeAction>('ADD_GRADE', async (action, ctx) => {
    const { courseId, name, score, maxScore, weight, category, date } = action.payload;
    const grade = await ctx.prisma.grade.create({
        data: {
            courseId,
            name,
            score,
            maxScore,
            weight,
            category,
            date: new Date(date),
            userId: ctx.userId,
        },
    });
    return {
        success: true,
        data: grade,
        message: `Grade "${grade.name}" added to course.`,
        metadata: {
            sectionName: 'School',
            redirectPath: '/school'
        }
    };
});

registerActionHandler<UpdateGradeAction>('UPDATE_GRADE', async (action, ctx) => {
    const { id, updates } = action.payload;
    const grade = await ctx.prisma.grade.update({
        where: { id, userId: ctx.userId },
        data: {
            ...updates,
            date: updates.date ? new Date(updates.date) : undefined,
        },
    });
    return { success: true, data: grade, message: `Grade updated.` };
});

registerActionHandler<DeleteGradeAction>('DELETE_GRADE', async (action, ctx) => {
    return { success: false, confirmationRequired: true, message: "Are you sure you want to delete this grade?" };
});

// Notes
registerActionHandler<CreateNoteAction>('CREATE_NOTE', async (action, ctx) => {
    const { title, content, tags } = action.payload;
    const note = await ctx.prisma.quickNote.create({
        data: {
            content: `${title}\n\n${content}`,
            tags,
            userId: ctx.userId,
            type: 'note',
        },
    });
    return {
        success: true,
        data: note,
        message: `Note saved.`,
        metadata: {
            sectionName: 'Notes',
            redirectPath: '/notes'
        }
    };
});

registerActionHandler<UpdateNoteAction>('UPDATE_NOTE', async (action, ctx) => {
    const { id, updates } = action.payload;
    const note = await ctx.prisma.quickNote.update({
        where: { id, userId: ctx.userId },
        data: {
            content: updates.content,
            tags: updates.tags,
        },
    });
    return { success: true, data: note, message: `Note updated.` };
});

// Analysis
registerActionHandler<AnalyzeProgressAction>('ANALYZE_PROGRESS', async (action, ctx) => {
    const { period } = action.payload;
    const now = new Date();
    let startDate = new Date();
    if (period === 'week') startDate.setDate(now.getDate() - 7);
    else if (period === 'month') startDate.setMonth(now.getMonth() - 1);
    else if (period === 'year') startDate.setFullYear(now.getFullYear() - 1);

    const completedWorkouts = await ctx.prisma.workoutLog.count({
        where: {
            routine: { userId: ctx.userId },
            completed: true,
            date: { gte: startDate },
        },
    });

    const completedTasks = await ctx.prisma.task.count({
        where: {
            userId: ctx.userId,
            status: 'done',
            updatedAt: { gte: startDate },
        },
    });

    const insights = [];
    if (completedWorkouts > 3) insights.push("Great workout consistency!");
    else insights.push("Try to increase workout frequency.");
    if (completedTasks > 10) insights.push("High productivity detected.");

    return {
        success: true,
        data: {
            summary: `In the last ${period}, you completed ${completedWorkouts} workouts and ${completedTasks} tasks.`,
            risks: completedWorkouts === 0 ? ["Sedentary behavior detected"] : [],
            insights,
            suggestedActions: [],
        },
    };
});

// System Query
registerActionHandler<SystemQueryAction>('SYSTEM_QUERY', async (action, ctx) => {
    const { entity, filters } = action.payload;
    let data: any[] = [];

    if (entity === 'routines') {
        data = await ctx.prisma.routine.findMany({ where: { userId: ctx.userId } });
    } else if (entity === 'tasks') {
        data = await ctx.prisma.task.findMany({ where: { userId: ctx.userId } });
    } else if (entity === 'notes') {
        data = await ctx.prisma.quickNote.findMany({ where: { userId: ctx.userId } });
    } else if (entity === 'projects') {
        data = await ctx.prisma.project.findMany({ where: { userId: ctx.userId } });
    } else if (entity === 'courses') {
        data = await ctx.prisma.course.findMany({ where: { userId: ctx.userId } });
    } else if (entity === 'grades') {
        data = await ctx.prisma.grade.findMany({ where: { userId: ctx.userId } });
    } else {
        data = [];
    }

    return { success: true, data };
});

registerActionHandler<any>('DELETE_ALL_TASKS', async (action, ctx) => {
    const result = await ctx.prisma.task.deleteMany({
        where: { userId: ctx.userId }
    });
    return {
        success: true,
        message: `Deleted ${result.count} tasks.`,
        data: { count: result.count }
    };
});
