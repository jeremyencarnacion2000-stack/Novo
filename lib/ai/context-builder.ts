'use server';

import { prisma } from '@/lib/prisma';

/**
 * Context Builder
 * 
 * Builds a concise summary of the user's system state
 * to inject into the AI prompt for context-aware responses.
 */

export interface UserContext {
    summary: string;
    hasData: boolean;
    stats: {
        tasksActive: number;
        tasksPending: number;
        routinesTotal: number;
        habitsTotal: number;
        upcomingEvents: number;
    };
}

/**
 * Builds a comprehensive context string for the AI
 */
export async function buildUserContext(userId: string): Promise<UserContext> {
    try {
        // Fetch data in parallel for efficiency
        const [
            tasks,
            routines,
            habits,
            notes,
            events,
            workoutLogs,
        ] = await Promise.all([
            prisma.task.findMany({
                where: { userId, status: { not: 'done' } },
                orderBy: { dueDate: 'asc' },
                take: 10,
            }),
            prisma.routine.findMany({
                where: { userId },
                include: { days: { include: { exercises: true } } },
                orderBy: { updatedAt: 'desc' },
                take: 20,
            }),
            prisma.tracker.findMany({
                where: { userId, type: 'habit' },
                take: 10,
            }),
            prisma.quickNote.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 5,
            }),
            prisma.event.findMany({
                where: {
                    userId,
                    start: { gte: new Date() },
                },
                orderBy: { start: 'asc' },
                take: 5,
            }),
            prisma.workoutLog.findMany({
                where: {
                    routine: { userId },
                    date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
                },
                include: { routine: true },
                orderBy: { date: 'desc' },
                take: 5,
            }),
        ]);

        // Build summary sections
        const sections: string[] = [];

        // Tasks section
        if (tasks.length > 0) {
            const taskList = tasks.map(t => {
                const due = t.dueDate ? ` (vence: ${t.dueDate.toLocaleDateString('es')})` : '';
                const priority = t.priority === 'high' ? ' [ALTA]' : t.priority === 'medium' ? ' [MEDIA]' : '';
                return `  - ${t.title}${priority}${due}`;
            }).join('\n');
            sections.push(`📋 Tareas activas (${tasks.length}):\n${taskList}`);
        }

        // Routines section
        if (routines.length > 0) {
            const routineList = routines.map(r => {
                const dayCount = r.days?.length || 0;
                const exerciseCount = r.days?.reduce((acc, d) => acc + (d.exercises?.length || 0), 0) || 0;
                return `  - ${r.name} (${dayCount} días, ${exerciseCount} ejercicios)`;
            }).join('\n');
            sections.push(`🏋️ Rutinas (${routines.length}):\n${routineList}`);
        }

        // Recent workouts
        if (workoutLogs.length > 0) {
            const recentWorkouts = workoutLogs.slice(0, 3).map(w => {
                const date = w.date.toLocaleDateString('es', { weekday: 'short', day: 'numeric' });
                return `  - ${w.routine?.name || 'Workout'} el ${date}`;
            }).join('\n');
            sections.push(`💪 Entrenamientos recientes:\n${recentWorkouts}`);
        }

        // Habits section
        if (habits.length > 0) {
            const habitList = habits.slice(0, 5).map(h => `  - ${h.name}`).join('\n');
            sections.push(`✅ Hábitos (${habits.length}):\n${habitList}`);
        }

        // Upcoming events
        if (events.length > 0) {
            const eventList = events.slice(0, 3).map(e => {
                const date = e.start.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });
                const time = e.start.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
                return `  - ${e.title} - ${date} ${time}`;
            }).join('\n');
            sections.push(`📅 Próximos eventos:\n${eventList}`);
        }

        // Recent notes for context
        if (notes.length > 0) {
            const noteList = notes.slice(0, 3).map(n => {
                const preview = n.content?.slice(0, 50) || '';
                return `  - ${preview}${n.content && n.content.length > 50 ? '...' : ''}`;
            }).join('\n');
            sections.push(`📝 Notas recientes:\n${noteList}`);
        }

        const hasData = tasks.length > 0 || routines.length > 0 || habits.length > 0 || events.length > 0;

        const summary = sections.length > 0
            ? `\n--- ESTADO DEL SISTEMA DEL USUARIO ---\n${sections.join('\n\n')}\n--- FIN DEL CONTEXTO ---`
            : '\n--- El usuario no tiene datos en el sistema aún ---';

        return {
            summary,
            hasData,
            stats: {
                tasksActive: tasks.length,
                tasksPending: tasks.filter(t => t.status === 'todo').length,
                routinesTotal: routines.length,
                habitsTotal: habits.length,
                upcomingEvents: events.length,
            },
        };
    } catch (error) {
        console.error('[Context Builder] Error fetching user context:', error);
        return {
            summary: '\n--- Error al cargar el contexto del usuario ---',
            hasData: false,
            stats: {
                tasksActive: 0,
                tasksPending: 0,
                routinesTotal: 0,
                habitsTotal: 0,
                upcomingEvents: 0,
            },
        };
    }
}

/**
 * Builds a minimal context for quick queries
 */
export async function buildMinimalContext(userId: string): Promise<string> {
    try {
        const [taskCount, routineCount] = await Promise.all([
            prisma.task.count({ where: { userId, status: { not: 'done' } } }),
            prisma.routine.count({ where: { userId } }),
        ]);

        return `Usuario tiene ${taskCount} tareas activas y ${routineCount} rutinas.`;
    } catch (error) {
        return '';
    }
}
