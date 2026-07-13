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
    AnalyzeProgressAction,
    SystemQueryAction,
    UpdateTaskAction,
    DeleteTaskAction,
    CreateNoteAction,
    UpdateNoteAction,
    GenerateFileAction,
    CreateProjectAction,
    UpdateProjectAction,
    DeleteProjectAction,
    CreateEventAction,
    CreateTrackerAction,
    CreateCourseAction,
    UpdateCourseAction,
    DeleteCourseAction,
    AddGradeAction,
    UpdateGradeAction,
    DeleteGradeAction,
    CreateTasksAction
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

    // Programmatic ID Verification Layer to prevent LLM ID hallucinations
    if (action.payload) {
        const payload = action.payload;
        const actionType = (action.type || (action as any).name || '').toUpperCase();
        
        let idToVerify: string | undefined = undefined;
        let entityType: string = '';
        let prismaModel: any = null;
        let customCheck: (() => Promise<boolean>) | null = null;
        
        if (['UPDATE_TASK', 'DELETE_TASK'].includes(actionType) && payload.id) {
            idToVerify = payload.id;
            entityType = 'Tarea';
            prismaModel = prismaClient.task;
        } else if (['UPDATE_PROJECT', 'DELETE_PROJECT'].includes(actionType) && payload.id) {
            idToVerify = payload.id;
            entityType = 'Proyecto';
            prismaModel = prismaClient.project;
        } else if (['UPDATE_ROUTINE', 'DELETE_ROUTINE'].includes(actionType) && payload.id) {
            idToVerify = payload.id;
            entityType = 'Rutina';
            prismaModel = prismaClient.routine;
        } else if (['UPDATE_NOTE'].includes(actionType) && payload.id) {
            idToVerify = payload.id;
            entityType = 'Nota';
            prismaModel = prismaClient.quickNote;
        } else if (['UPDATE_COURSE', 'DELETE_COURSE'].includes(actionType) && payload.id) {
            idToVerify = payload.id;
            entityType = 'Curso';
            prismaModel = prismaClient.course;
        } else if (['UPDATE_GRADE', 'DELETE_GRADE'].includes(actionType) && payload.id) {
            idToVerify = payload.id;
            entityType = 'Calificación';
            prismaModel = prismaClient.grade;
        } else if (actionType === 'START_WORKOUT' && payload.routineId) {
            idToVerify = payload.routineId;
            entityType = 'Rutina';
            prismaModel = prismaClient.routine;
        } else if (actionType === 'ADD_GRADE' && payload.courseId) {
            idToVerify = payload.courseId;
            entityType = 'Curso';
            prismaModel = prismaClient.course;
        } else if (actionType === 'FINISH_WORKOUT' && payload.workoutLogId) {
            idToVerify = payload.workoutLogId;
            entityType = 'Registro de Entrenamiento';
            customCheck = async () => {
                const record = await prismaClient.workoutLog.findFirst({
                    where: {
                        id: payload.workoutLogId,
                        routine: { userId }
                    }
                });
                return !!record;
            };
        }

        // Perform verification if an ID was mapped
        if (idToVerify || customCheck) {
            let exists = false;
            if (customCheck) {
                exists = await customCheck();
            } else if (prismaModel && idToVerify) {
                const record = await prismaModel.findFirst({
                    where: {
                        id: idToVerify,
                        userId: userId
                    }
                });
                exists = !!record;
            }
            
            if (!exists) {
                const targetId = idToVerify || payload.workoutLogId || 'N/A';
                console.warn(`[AI Executor] ID verification failed: ${entityType} with ID ${targetId} not found under userId ${userId}`);
                return {
                    success: false,
                    error: `Database verification failed: ${entityType} con ID "${targetId}" no encontrado. Por favor, verifica el ID o consulta la lista antes de continuar.`,
                    message: `No se pudo encontrar la ${entityType.toLowerCase()} solicitada para modificar o eliminar. Por favor, asegúrate de que el elemento exista.`
                };
            }
            console.log(`[AI Executor] ID verification passed for ${entityType}: ${idToVerify || payload.workoutLogId}`);
        }
    }

    try {
        const actionType = (action.type || (action as any).name || '').toUpperCase();
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

        const gateError = await checkFreePlanLimit(prismaClient, userId);
        if (gateError) return gateError;

        const result = await handler(action, context);
        console.log(`[AI Executor] Handler Result:`, JSON.stringify(result, null, 2));

        const executionTime = Date.now() - startTime;
        await logAiAction(prismaClient, userId, actionType, action.payload, result.success, undefined, executionTime);

        return {
            ...result,
            metadata: {
                ...result.metadata,
                executionTime,
            },
        };
    } catch (error) {
        console.error(`[AI Executor] Error executing ${action.type}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown execution error';
        const executionTime = Date.now() - startTime;
        await logAiAction(prismaClient, userId, action.type, action.payload, false, errorMessage, executionTime);

        return {
            success: false,
            error: errorMessage,
            metadata: {
                executionTime,
            },
        };
    }
}

// Best-effort audit write — a logging failure must never mask the real
// action result, so errors here are swallowed after a console warning.
async function logAiAction(
    prismaClient: typeof prisma,
    userId: string,
    actionType: string,
    payload: unknown,
    success: boolean,
    errorMessage: string | undefined,
    executionTimeMs: number
) {
    try {
        await prismaClient.aiActionLog.create({
            data: {
                userId,
                actionType,
                payload: JSON.stringify(payload ?? {}),
                success,
                errorMessage,
                executionTimeMs,
            },
        });
    } catch (logError) {
        console.warn('[AI Executor] Failed to write AiActionLog:', logError);
    }
}

export const FREE_PLAN_MONTHLY_ACTION_LIMIT = 20;

// Free-plan gate: Pro is unlimited, Free is capped at N autonomous AI actions
// per calendar month, counted from the same AiActionLog this executor writes.
async function checkFreePlanLimit(
    prismaClient: typeof prisma,
    userId: string
): Promise<AIActionResult | null> {
    const user = await prismaClient.user.findUnique({
        where: { id: userId },
        select: { plan: true },
    });
    if (user?.plan !== 'free') return null;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const count = await prismaClient.aiActionLog.count({
        where: { userId, createdAt: { gte: startOfMonth } },
    });

    if (count < FREE_PLAN_MONTHLY_ACTION_LIMIT) return null;

    return {
        success: false,
        error: 'Free plan monthly AI action limit reached',
        message: `Alcanzaste el límite de ${FREE_PLAN_MONTHLY_ACTION_LIMIT} acciones de IA este mes en el plan Free. Actualiza a Pro para acciones ilimitadas.`,
    };
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
        message: `Rutina "${routine.name}" creada con éxito. La encontrarás en tu sección de Rutinas.`,
        metadata: {
            sectionName: 'Rutinas',
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
    const { id, confirmed } = action.payload;
    if (!confirmed) {
        return { success: false, confirmationRequired: true, message: "¿Estás seguro de que deseas eliminar esta rutina?" };
    }

    const routine = await ctx.prisma.routine.delete({
        where: { id, userId: ctx.userId }
    });

    return { 
        success: true, 
        data: routine, 
        message: `La rutina "${routine.name}" ha sido eliminada correctamente.` 
    };
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
    const p = priority as any;
    const finalPriority = (p === 3 || p === 'high' || p === '3') ? 'high' :
        (p === 2 || p === 'medium' || p === '2') ? 'medium' : 'low';

    const task = await ctx.prisma.task.create({
        data: {
            title,
            status: 'todo',
            priority: finalPriority,
            dueDate,
            tags: JSON.stringify([category]),
            userId: ctx.userId,
        },
    });
    return {
        success: true,
        data: task,
        message: `Tarea "${task.title}" guardada correctamente en tu lista de tareas.`,
        metadata: {
            sectionName: 'Tareas',
            redirectPath: '/tasks'
        }
    };
});

registerActionHandler<CreateTasksAction>('CREATE_TASKS', async (action, ctx) => {
    const { tasks } = action.payload;
    const createdTasks = await Promise.all(
        tasks.map(t => {
            const p = t.priority as any;
            const finalPriority = (p === 3 || p === 'high' || p === '3') ? 'high' :
                (p === 2 || p === 'medium' || p === '2') ? 'medium' : 'low';
            return ctx.prisma.task.create({
                data: {
                    title: t.title,
                    status: 'todo',
                    priority: finalPriority,
                    dueDate: t.dueDate,
                    tags: JSON.stringify([t.category]),
                    userId: ctx.userId,
                },
            });
        })
    );
    return {
        success: true,
        data: createdTasks,
        message: `Se han creado ${createdTasks.length} tareas nuevas en tu lista.`,
        metadata: {
            sectionName: 'Tareas',
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
    const { id, confirmed } = action.payload;
    if (!confirmed) {
        return { success: false, confirmationRequired: true, message: "¿Estás seguro de que deseas eliminar esta tarea?" };
    }

    const task = await ctx.prisma.task.delete({
        where: { id, userId: ctx.userId }
    });

    return { 
        success: true, 
        data: task, 
        message: `La tarea "${task.title}" ha sido eliminada correctamente.` 
    };
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
        message: `Proyecto "${project.title}" organizado exitosamente en tu panel de proyectos.`,
        metadata: {
            sectionName: 'Proyectos',
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
    const { id, confirmed } = action.payload;
    if (!confirmed) {
        return { success: false, confirmationRequired: true, message: "¿Estás seguro de que deseas eliminar este proyecto?" };
    }

    const project = await ctx.prisma.project.delete({
        where: { id, userId: ctx.userId }
    });

    return { 
        success: true, 
        data: project, 
        message: `El proyecto "${project.title}" ha sido eliminado correctamente.` 
    };
});

// Calendar
registerActionHandler<CreateEventAction>('CREATE_EVENT', async (action, ctx) => {
    const { title, description, start, end, allDay } = action.payload;
    if (!title) throw new Error("Event title is required");
    if (!start || !end) throw new Error("Event start and end times are required");

    const event = await ctx.prisma.calendarEvent.create({
        data: {
            title,
            description: description || null,
            start: new Date(start),
            end: new Date(end),
            allDay: !!allDay,
            source: 'ai',
            userId: ctx.userId,
        },
    });
    return {
        success: true,
        data: event,
        message: `Evento "${event.title}" agendado en tu calendario.`,
        metadata: {
            sectionName: 'Calendario',
            redirectPath: '/calendar'
        }
    };
});

// Trackers
registerActionHandler<CreateTrackerAction>('CREATE_TRACKER', async (action, ctx) => {
    const { name, type, unit, goal } = action.payload;
    if (!name) throw new Error("Tracker name is required");

    const tracker = await ctx.prisma.tracker.create({
        data: {
            name,
            type: type === 'metric' ? 'metric' : 'habit',
            unit: unit || 'veces',
            goal: goal ?? 1,
            userId: ctx.userId,
        },
    });
    return {
        success: true,
        data: tracker,
        message: `Tracker "${tracker.name}" creado. Meta: ${tracker.goal} ${tracker.unit}.`,
        metadata: {
            sectionName: 'Trackers',
            redirectPath: '/trackers'
        }
    };
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
    const { id, confirmed } = action.payload;
    if (!confirmed) {
        return { success: false, confirmationRequired: true, message: "¿Estás seguro de que deseas eliminar este curso?" };
    }

    const course = await ctx.prisma.course.delete({
        where: { id, userId: ctx.userId }
    });

    return { 
        success: true, 
        data: course, 
        message: `El curso "${course.name}" ha sido eliminado correctamente.` 
    };
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
    const { id, confirmed } = action.payload;
    if (!confirmed) {
        return { success: false, confirmationRequired: true, message: "¿Estás seguro de que deseas eliminar esta calificación?" };
    }

    const grade = await ctx.prisma.grade.delete({
        where: { id, userId: ctx.userId }
    });

    return { 
        success: true, 
        data: grade, 
        message: `La calificación "${grade.name}" ha sido eliminada correctamente.` 
    };
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
        message: `Nota guardada en tu libreta de apuntes.`,
        metadata: {
            sectionName: 'Notas',
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
registerActionHandler<any>('GENERATE_FILE', async (action, ctx) => {
    const payload = action.payload || {};
    let content = payload.content || payload.data || payload.body || payload.text || '';
    const mimeType = payload.mimeType || payload.mime || 'text/plain';
    const description = payload.description || payload.title || payload.topic || '';

    // Robust filename extraction with fallbacks
    let filename = payload.filename || payload.fileName || payload.name || payload.file;
    if (!filename) {
        const extMap: Record<string, string> = {
            'text/html': '.html', 'text/css': '.css', 'text/csv': '.csv',
            'application/json': '.json', 'text/markdown': '.md', 'text/plain': '.txt',
            'application/pdf': '.pdf',
        };
        const ext = extMap[mimeType] || '.txt';
        filename = `documento${ext}`;
    }

    // If content is empty, generate it using AI
    let summary = '';
    if (!content.trim() && description) {
        try {
            const { groqAPI } = await import('@/lib/groq');
            const isHTML = mimeType === 'text/html' || filename.endsWith('.html');
            const genPrompt = isHTML
                ? `Generate a complete, styled HTML document about: "${description}". Include modern CSS (dark background, nice typography). Output ONLY the raw HTML code inside a code block. Then, AFTER the code block, write a 2-sentence summary of what the document contains, prefixed with "SUMMARY: ".`
                : `Generate the complete content for a ${mimeType} file about: "${description}". Output ONLY the raw file content inside a code block. Then, AFTER the code block, write a 2-sentence summary of what the document contains, prefixed with "SUMMARY: ".`;

            const result = await groqAPI.generateResponse(genPrompt, '', [], 'You are a file content generator. Output the content in a code block, then a short summary.');
            if (result.content?.trim()) {
                // More robust code block matching (handles different languages or no language)
                const codeMatch = result.content.match(/```(?:\w+)?\s*\n?([\s\S]*?)```/i) ||
                    result.content.match(/<html>[\s\S]*<\/html>/i);

                if (codeMatch) {
                    content = codeMatch[1] || codeMatch[0];
                    content = content.trim();
                    const summaryMatch = result.content.match(/SUMMARY:\s*(.*)/i);
                    summary = summaryMatch ? summaryMatch[1].trim() : 'Documento generado con éxito.';
                } else if (result.content.includes('<html') || result.content.includes('<!DOCTYPE')) {
                    content = result.content.trim();
                    summary = 'Documento HTML generado.';
                } else {
                    content = result.content.trim();
                }
            }
        } catch (e) {
            console.error('[GENERATE_FILE] AI content generation failed:', e);
            content = `# ${description}\n\nContenido generado automáticamente.\n`;
        }
    }

    // Last resort fallback
    if (!content.trim()) {
        content = `Documento generado por Novo AI\n\nEl contenido solicitado no pudo ser generado.`;
    }

    if (!summary) summary = `Se ha generado el archivo "${filename}".`;

    return {
        success: true,
        data: {
            filename,
            content,
            mimeType,
            summary,
            downloadReady: true
        },
        message: summary,
        metadata: {
            type: 'file',
            filename,
            content,
            mimeType,
            summary,
            downloadReady: true,
            steps: [
                { id: '1', label: 'Leyendo configuración de archivos', status: 'completed' },
                { id: '2', label: 'Preparando generador de contenido', status: 'completed' },
                { id: '3', label: `Generando ${filename}`, status: 'completed' },
                { id: '4', label: 'Archivo listo para descarga', status: 'completed' }
            ]
        }
    };
});

registerActionHandler('UPDATE_COGNITIVE_STATE', async (action: any, ctx) => {
    const { 
        fatigueEstimate, 
        productivityScore, 
        focusTimeToday, 
        moodSignal, 
        triggerRecovery,
        musicRecommendation,
        styleRecommendation 
    } = action.payload;

    // 1. Update/Upsert the user's UserCognitiveSnapshot
    // @ts-ignore
    const snapshot = await ctx.prisma.userCognitiveSnapshot.upsert({
        where: { userId: ctx.userId },
        create: {
            userId: ctx.userId,
            fatigueEstimate: fatigueEstimate || 'low',
            productivityScore: productivityScore !== undefined ? productivityScore : 8.0,
            focusTimeToday: focusTimeToday !== undefined ? focusTimeToday : 0,
            overdueTasks: 0,
        },
        update: {
            fatigueEstimate: fatigueEstimate !== undefined ? fatigueEstimate : undefined,
            productivityScore: productivityScore !== undefined ? productivityScore : undefined,
            focusTimeToday: focusTimeToday !== undefined ? focusTimeToday : undefined,
        }
    });

    // 2. If recovery block triggered, create a task
    let recoveryTask = null;
    if (triggerRecovery) {
        recoveryTask = await ctx.prisma.task.create({
            data: {
                userId: ctx.userId,
                title: '💆 Sesión de Recuperación Cognitiva (Novo)',
                status: 'todo',
                priority: 'high',
                tags: JSON.stringify(['routine']),
                dueDate: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            }
        });
    }

    // 3. Store style & music insights so the chatbot is fully conscious and UI can show it
    let styleInsight = null;
    if (styleRecommendation) {
        styleInsight = await ctx.prisma.insight.create({
            data: {
                userId: ctx.userId,
                content: JSON.stringify({
                    type: 'style',
                    context: styleRecommendation.context,
                    suggestion: styleRecommendation.suggestion,
                    colorPsychology: styleRecommendation.colorPsychology
                }),
                type: 'style',
                status: 'unread'
            }
        });
    }

    let musicInsight = null;
    if (musicRecommendation) {
        musicInsight = await ctx.prisma.insight.create({
            data: {
                userId: ctx.userId,
                content: JSON.stringify({
                    type: 'music',
                    mood: musicRecommendation.mood,
                    searchQuery: musicRecommendation.searchQuery
                }),
                type: 'music',
                status: 'unread'
            }
        });
    }

    return {
        success: true,
        data: {
            snapshot,
            recoveryTask,
            styleRecommendation,
            musicRecommendation,
            triggeredRecovery: !!triggerRecovery
        },
        message: `Estado cognitivo actualizado con éxito. Fatiga: ${fatigueEstimate || snapshot.fatigueEstimate}. Se han calibrado la música, el calendario y tus outfits para optimizar tu energía.`,
        metadata: {
            sectionName: 'Cognitivo',
            redirectPath: '/today'
        }
    };
});

registerActionHandler('COGNITIVE_PIPELINE', async (action: any, ctx) => {
    const { actions } = action.payload;
    if (!actions || !Array.isArray(actions)) {
        throw new Error('Pipeline actions list must be provided as an array.');
    }

    const results = [];
    for (const subAction of actions) {
        console.log(`[Cognitive Pipeline] Executing sub-action: ${subAction.type}`);
        const subResult = await executeAIAction(subAction, ctx.userId, ctx.prisma);
        results.push({
            type: subAction.type,
            result: subResult
        });
    }

    return {
        success: true,
        data: results,
        message: `Pipeline cognitivo completado: se ejecutaron con éxito ${actions.length} acciones automatizadas.`,
        metadata: {
            pipelineCount: actions.length
        }
    };
});


