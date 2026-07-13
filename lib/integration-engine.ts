// Integration Engine - Central orchestrator for cross-module synchronization

import { prisma } from './prisma';

export interface IntegratedTask {
    id: string;
    text: string;
    completed: boolean;
    priority: 'low' | 'medium' | 'high';
    source: 'routine' | 'project' | 'manual' | 'school' | 'notion' | 'ai-task';
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
        const [routines, projects, checklistItems, aiTasks, courses] = await Promise.all([
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
            // 3. Manual and Notion checklist items
            prisma.checklistItem.findMany({
                where: { userId, source: { in: ['manual', 'notion'] } }
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
        ]);

        for (const routine of routines) {
            for (const task of routine.tasks) {
                tasks.push({
                    id: `routine:${routine.id}:task:${task.id}`,
                    text: task.text,
                    completed: task.completed,
                    priority: 'medium',
                    source: 'routine',
                    sourceId: routine.id,
                    timeOfDay: routine.timeOfDay,
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

        // 3. Manual and Notion checklist items
        for (const item of checklistItems) {
            tasks.push({
                id: `checklist:${item.id}`,
                text: item.text,
                completed: item.completed,
                priority: item.priority as 'low' | 'medium' | 'high',
                source: item.source as 'manual' | 'notion',
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
     * Sync task completion across sources
     */
    static async syncCompletion(taskId: string, completed: boolean): Promise<void> {
        const [source, ...idParts] = taskId.split(':');

        switch (source) {
            case 'routine':
                const [routineId, , taskIdPart] = idParts;
                await prisma.routineTask.update({
                    where: { id: taskIdPart },
                    data: { completed }
                });
                break;

            case 'project':
                const [projectId, , subtaskId] = idParts;
                await prisma.subtask.update({
                    where: { id: subtaskId },
                    data: { completed }
                });
                break;

            case 'checklist':
                const checklistId = idParts[0];
                const item = await prisma.checklistItem.update({
                    where: { id: checklistId },
                    data: { completed }
                });

                if (item.source === 'notion' && item.sourceId) {
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
                        }
                    } catch (notionError) {
                        console.error('Failed to sync completion to Notion:', notionError);
                    }
                }
                break;

            case 'school':
                // School grades don't have a "completed" status
                // When user completes, we could create a checklist reminder to study
                break;

            case 'task':
                const aiTaskId = idParts[0];
                await prisma.task.update({
                    where: { id: aiTaskId },
                    data: { status: completed ? 'done' : 'todo' }
                });
                break;
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
