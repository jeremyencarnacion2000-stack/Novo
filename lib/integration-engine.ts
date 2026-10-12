// Integration Engine - Central orchestrator for cross-module synchronization

import { prisma } from './prisma';

export interface IntegratedTask {
    id: string;
    text: string;
    completed: boolean;
    priority: 'low' | 'medium' | 'high';
    source: 'routine' | 'project' | 'manual' | 'school' | 'notion' | 'todoist' | 'ai-task';
    sourceId: string;
    dueDate?: Date;
    timeOfDay?: string; // for routine tasks
    scheduledHour?: number | null; // 0-23, set by the cognitive engine's auto-schedule
    scheduledReason?: string | null;
    metadata?: {
        projectTitle?: string;
        routineName?: string;
        courseCode?: string;
        category?: string;
    };
}

export interface UrgentItem {
    id: string;
    title: string;
    dueDate: Date;
    type: 'assignment' | 'exam' | 'project';
    courseName: string;
    courseCode: string;
    urgencyLevel: 'critical' | 'high' | 'medium'; // <24h, 24-48h, 48-72h
    weight?: number; // For GPA-weighted priority
}

export interface CompletionSyncResult {
    persisted: boolean;
    /** The local record is authoritative, but an external provider may fail
     * after it has been updated. Keeping that distinction lets the UI remain
     * truthful without rolling back a change that Novo did save. */
    externalSync?: 'synced' | 'failed' | 'not_applicable';
    source?: 'notion' | 'todoist';
}

export class IntegrationEngine {
    /**
     * Get all tasks for today from all sources
     */
    static async getTodayTasks(userId: string): Promise<IntegratedTask[]> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const currentHour = new Date().getHours();
        let timeOfDay: string;
        if (currentHour < 12) timeOfDay = 'morning';
        else if (currentHour < 18) timeOfDay = 'afternoon';
        else timeOfDay = 'evening';

        const tasks: IntegratedTask[] = [];
        const todayStr = today.toISOString().split('T')[0];

        // All 5 sources are independent reads — fetch them in parallel
        // instead of one round trip after another.
        const [routines, projects, checklistItems, aiTasks, courses, currentPlan] = await Promise.all([
            // 1. Routine tasks for current time of day
            prisma.routine.findMany({
                where: {
                    userId,
                    isActive: true,
                    OR: [
                        { timeOfDay },
                        { timeOfDay: 'anytime' }
                    ]
                },
                include: { tasks: true }
            }),
            // 2. Project subtasks due today
            prisma.project.findMany({
                where: { userId },
                include: {
                    subtasks: {
                        where: { dueDate: { gte: today, lt: tomorrow } }
                    }
                }
            }),
            // 3. Manual, Notion, and Todoist checklist items
            prisma.checklistItem.findMany({
                where: { userId, source: { in: ['manual', 'notion', 'todoist'] } },
                // Today is a bounded working surface. Keep it responsive for
                // long-lived workspaces while retaining the most actionable
                // rows first (open items, due items, then recently touched).
                orderBy: [
                    { completed: 'asc' },
                    { dueDate: 'asc' },
                    { updatedAt: 'desc' },
                ],
                take: 200,
            }),
            // 3b. Task-model tasks (created via /api/tasks or the AI assistant's
            // CREATE_TASK / CREATE_TASKS actions) — due today, or already
            // assigned a scheduledHour by the cognitive engine (which only
            // ever schedules for the current day).
            prisma.task.findMany({
                where: {
                    userId,
                    status: { not: 'done' },
                    OR: [
                        { dueDate: todayStr },
                        { scheduledHour: { not: null } },
                    ],
                }
            }),
            // 4. School assignments due today
            prisma.course.findMany({
                where: { userId },
                include: {
                    grades: {
                        where: {
                            date: { gte: today, lt: tomorrow },
                            category: { in: ['Exam', 'Assignment', 'Project', 'Quiz'] }
                        }
                    }
                }
            }),
            prisma.actionPlan.findFirst({ where: { userId, status: 'active' }, orderBy: { createdAt: 'desc' }, include: { actions: true } }),
        ]);

        // A canonical recommendation may be undated and therefore absent
        // from the normal Today task query. Resolve that durable task once so
        // Today still reflects the active plan after a replan.
        const canonicalTaskId = currentPlan?.actions?.find((action) => ['proposed', 'accepted', 'modified', 'started'].includes(action.status))?.taskId;
        const canonicalTask = canonicalTaskId && !aiTasks.some((task) => task.id === canonicalTaskId)
            ? await prisma.task.findFirst({ where: { id: canonicalTaskId, userId, status: { not: 'done' } } })
            : null;

        const weekday = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][today.getDay()]
        for (const routine of routines) {
            // A blank schedule means every day. When the user selected days
            // in the routine editor, only surface that routine on its selected
            // weekday so Today does not repeat every routine every day.
            if (routine.daysOfWeek) {
                try {
                    const selectedDays = JSON.parse(routine.daysOfWeek)
                    if (Array.isArray(selectedDays) && selectedDays.length > 0 && !selectedDays.includes(weekday)) continue
                } catch {
                    // Preserve legacy rows with malformed schedule data rather
                    // than hiding their tasks completely.
                }
            }
            for (const task of routine.tasks) {
                tasks.push({
                    id: `routine:${routine.id}:task:${task.id}`,
                    text: task.text,
                    completed: task.completed,
                    priority: 'medium',
                    source: 'routine',
                    sourceId: routine.id,
                    timeOfDay: routine.timeOfDay,
                    scheduledHour: routine.scheduledTime ? Number(routine.scheduledTime.slice(0, 2)) : null,
                    scheduledReason: routine.scheduledTime ? 'Rutina programada' : null,
                    metadata: {
                        routineName: routine.name,
                        category: routine.timeOfDay
                    }
                });
            }
        }

        // 2. Project subtasks due today
        for (const project of projects) {
            for (const subtask of project.subtasks) {
                const priority = this.mapProjectPriority(project.priority);
                tasks.push({
                    id: `project:${project.id}:subtask:${subtask.id}`,
                    text: subtask.title,
                    completed: subtask.completed,
                    priority,
                    source: 'project',
                    sourceId: project.id,
                    dueDate: subtask.dueDate ?? undefined,
                    metadata: {
                        projectTitle: project.title,
                        category: project.status
                    }
                });
            }
        }

        // 3. Manual, Notion, and Todoist checklist items. A Task created with
        // a due date also gets a linked checklist row for legacy surfaces;
        // Today must render the canonical Task exactly once rather than
        // showing both records as two separate pieces of work.
        for (const item of checklistItems) {
            if (item.taskId) continue;
            tasks.push({
                id: `checklist:${item.id}`,
                text: item.text,
                completed: item.completed,
                priority: item.priority as 'low' | 'medium' | 'high',
                source: item.source as 'manual' | 'notion' | 'todoist',
                sourceId: item.id,
                dueDate: item.dueDate ?? undefined
            });
        }

        // 3b. Task-model tasks (created via /api/tasks or the AI assistant's
        // CREATE_TASK / CREATE_TASKS actions)
        for (const task of aiTasks) {
            tasks.push({
                id: `task:${task.id}`,
                text: task.title,
                completed: task.status === 'done',
                priority: task.priority as 'low' | 'medium' | 'high',
                source: 'ai-task',
                sourceId: task.id,
                scheduledHour: task.scheduledHour,
                scheduledReason: task.scheduledReason,
            });
        }

        // The canonical active plan is authoritative for the current action.
        // Surface it through the same Today collection so replans are visible
        // without provider-specific branches or client-side injection.
        const canonical = currentPlan?.actions?.find((action) => ['proposed', 'accepted', 'modified', 'started'].includes(action.status) && action.taskId);
        if (canonical?.taskId && !tasks.some((task) => task.source === 'ai-task' && task.sourceId === canonical.taskId)) {
            const task = aiTasks.find((item) => item.id === canonical.taskId) || canonicalTask;
            if (task && task.status !== 'done') {
                tasks.unshift({ id: `task:${task.id}`, text: task.title, completed: false, priority: task.priority as 'low' | 'medium' | 'high', source: 'ai-task', sourceId: task.id, scheduledHour: task.scheduledHour, scheduledReason: task.scheduledReason });
            }
        }

        // 4. School assignments due today (if any)
        for (const course of courses) {
            for (const grade of course.grades) {
                if (!grade.score || grade.score === 0) {
                    // Upcoming assignment (no score yet)
                    tasks.push({
                        id: `school:${course.id}:grade:${grade.id}`,
                        text: `${course.code || 'COURSE'}: ${grade.name}`,
                        completed: false,
                        priority: this.calculateSchoolPriority(grade.weight, grade.date),
                        source: 'school',
                        sourceId: course.id,
                        dueDate: grade.date,
                        metadata: {
                            courseCode: course.code || undefined,
                            category: grade.category || undefined
                        }
                    });
                }
            }
        }

        // Sort by priority and time
        return this.sortTasks(tasks);
    }

    /**
     * Get urgent school items (24-72h deadline)
     */
    static async getUrgentItems(userId: string): Promise<UrgentItem[]> {
        const now = new Date();
        const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const in72h = new Date(now.getTime() + 72 * 60 * 60 * 1000);

        const courses = await prisma.course.findMany({
            where: {
                userId
            },
            include: {
                grades: {
                    where: {
                        date: {
                            gte: now,
                            lte: in72h
                        },
                        category: {
                            in: ['Exam', 'Assignment', 'Project', 'Quiz']
                        }
                    },
                    orderBy: {
                        date: 'asc'
                    }
                }
            }
        });

        const urgentItems: UrgentItem[] = [];

        for (const course of courses) {
            for (const grade of course.grades) {
                if (!grade.score || grade.score === 0) {
                    // Upcoming assignment
                    const hoursUntilDue = (grade.date.getTime() - now.getTime()) / (1000 * 60 * 60);

                    let urgencyLevel: 'critical' | 'high' | 'medium';
                    if (hoursUntilDue < 24) urgencyLevel = 'critical';
                    else if (hoursUntilDue < 48) urgencyLevel = 'high';
                    else urgencyLevel = 'medium';

                    urgentItems.push({
                        id: `school:${course.id}:grade:${grade.id}`,
                        title: grade.name,
                        dueDate: grade.date,
                        type: (grade.category?.toLowerCase() || 'assignment') as 'assignment' | 'exam' | 'project',
                        courseName: course.name,
                        courseCode: course.code || '',
                        urgencyLevel,
                        weight: grade.weight || 0
                    });
                }
            }
        }

        return urgentItems;
    }

    /**
     * Sync task completion across sources.
     * Returns false when the source has no real "completed" concept to persist
     * (e.g. 'school' grades, or an unrecognized id prefix) — callers use this
     * to reject the request instead of reporting success for a checkbox that
     * silently reverts on the next load.
     */
    static async syncCompletion(userId: string, taskId: string, completed: boolean): Promise<boolean> {
        const result = await this.syncCompletionDetailed(userId, taskId, completed);
        return result.persisted;
    }

    static async syncCompletionDetailed(userId: string, taskId: string, completed: boolean): Promise<CompletionSyncResult> {
        const [source, ...idParts] = taskId.split(':');

        switch (source) {
            case 'routine': {
                const [routineId, , taskIdPart] = idParts;
                if (!routineId || !taskIdPart) return { persisted: false };
                const updated = await prisma.routineTask.updateMany({
                    where: { id: taskIdPart, routine: { id: routineId, userId } },
                    data: { completed }
                });
                return { persisted: updated.count > 0 };
            }

            case 'project': {
                const [projectId, , subtaskId] = idParts;
                if (!projectId || !subtaskId) return { persisted: false };
                const updated = await prisma.subtask.updateMany({
                    where: { id: subtaskId, project: { id: projectId, userId } },
                    data: { completed }
                });
                return { persisted: updated.count > 0 };
            }

            case 'checklist': {
                const checklistId = idParts[0];
                if (!checklistId) return { persisted: false };
                const item = await prisma.checklistItem.findFirst({
                    where: { id: checklistId, userId },
                });
                if (!item) return { persisted: false };
                const updated = await prisma.checklistItem.updateMany({
                    where: { id: checklistId, userId },
                    data: { completed }
                });
                if (!updated.count) return { persisted: false };

                let externalSync: CompletionSyncResult['externalSync'] = 'not_applicable';
                let externalSource: CompletionSyncResult['source'];

                if (item.source === 'notion' && item.sourceId) {
                    externalSource = 'notion';
                    try {
                        const integrationAccount = await prisma.integrationAccount.findUnique({
                            where: {
                                userId_provider: {
                                    userId: item.userId,
                                    provider: 'notion'
                                }
                            }
                        });
                        if (integrationAccount) {
                            const { notionService } = await import('./notion');
                            await notionService.updatePageCompletion(
                                integrationAccount.accessToken,
                                item.sourceId,
                                completed
                            );
                            externalSync = 'synced';
                        } else externalSync = 'failed';
                    } catch {
                        console.error('Failed to sync completion to Notion.');
                        externalSync = 'failed';
                        externalSource = 'notion';
                    }
                } else if (item.source === 'todoist' && item.sourceId) {
                    externalSource = 'todoist';
                    try {
                        const integrationAccount = await prisma.integrationAccount.findUnique({
                            where: {
                                userId_provider: {
                                    userId: item.userId,
                                    provider: 'todoist'
                                }
                            }
                        });
                        if (integrationAccount) {
                            const { todoistService } = await import('./todoist');
                            if (completed) {
                                await todoistService.closeTask(integrationAccount.accessToken, item.sourceId);
                            } else {
                                await todoistService.reopenTask(integrationAccount.accessToken, item.sourceId);
                            }
                            externalSync = 'synced';
                        } else externalSync = 'failed';
                    } catch {
                        console.error('Failed to sync completion to Todoist.');
                        externalSync = 'failed';
                        externalSource = 'todoist';
                    }
                }
                return { persisted: true, externalSync, source: externalSource };
            }

            case 'school':
                // School grades don't have a "completed" status — nothing to
                // persist. Report failure so the UI doesn't show a checkbox
                // that silently un-checks itself on next load.
                return { persisted: false };

            case 'task': {
                const aiTaskId = idParts[0];
                if (!aiTaskId) return { persisted: false };
                const updated = await prisma.task.updateMany({
                    where: { id: aiTaskId, userId },
                    data: { status: completed ? 'done' : 'todo' }
                });
                return { persisted: updated.count > 0 };
            }

            default:
                return { persisted: false };
        }
    }

    /**
     * Helper: Map project priority to standard priority
     */
    private static mapProjectPriority(projectPriority: string): 'low' | 'medium' | 'high' {
        if (projectPriority === 'high') return 'high';
        if (projectPriority === 'medium') return 'medium';
        return 'low';
    }

    /**
     * Helper: Calculate school priority based on weight and due date
     */
    private static calculateSchoolPriority(weight: number, dueDate: Date): 'low' | 'medium' | 'high' {
        const hoursUntilDue = (dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60);

        // High weight (>30%) or very soon (<12h) = high priority
        if (weight > 30 || hoursUntilDue < 12) return 'high';

        // Medium weight (15-30%) or soon (<24h) = medium priority
        if (weight > 15 || hoursUntilDue < 24) return 'medium';

        return 'low';
    }

    /**
     * Helper: Sort tasks by priority and time
     */
    private static sortTasks(tasks: IntegratedTask[]): IntegratedTask[] {
        const priorityOrder = { high: 0, medium: 1, low: 2 };

        return tasks.sort((a, b) => {
            // First by priority
            const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
            if (priorityDiff !== 0) return priorityDiff;

            // Then by due date (if exists)
            if (a.dueDate && b.dueDate) {
                return a.dueDate.getTime() - b.dueDate.getTime();
            }
            if (a.dueDate) return -1;
            if (b.dueDate) return 1;

            // Finally alphabetically
            return a.text.localeCompare(b.text);
        });
    }
}
