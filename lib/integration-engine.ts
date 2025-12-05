// Integration Engine - Central orchestrator for cross-module synchronization

import { prisma } from './prisma';

export interface IntegratedTask {
    id: string;
    text: string;
    completed: boolean;
    priority: 'low' | 'medium' | 'high';
    source: 'routine' | 'project' | 'manual' | 'school';
    sourceId: string;
    dueDate?: Date;
    timeOfDay?: string; // for routine tasks
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

        // 1. Get routine tasks for current time of day
        const routines = await prisma.routine.findMany({
            where: {
                userId,
                isActive: true,
                OR: [
                    { timeOfDay },
                    { timeOfDay: 'anytime' }
                ]
            },
            include: {
                tasks: true
            }
        });

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

        // 2. Get project subtasks due today
        const projects = await prisma.project.findMany({
            where: {
                userId
            },
            include: {
                subtasks: {
                    where: {
                        dueDate: {
                            gte: today,
                            lt: tomorrow
                        }
                    }
                }
            }
        });

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

        // 3. Get manual checklist items
        const checklistItems = await prisma.checklistItem.findMany({
            where: {
                userId,
                source: 'manual'
            }
        });

        for (const item of checklistItems) {
            tasks.push({
                id: `checklist:${item.id}`,
                text: item.text,
                completed: item.completed,
                priority: item.priority as 'low' | 'medium' | 'high',
                source: 'manual',
                sourceId: item.id,
                dueDate: item.dueDate ?? undefined
            });
        }

        // 4. Get school assignments due today (if any)
        const courses = await prisma.course.findMany({
            where: {
                userId
            },
            include: {
                grades: {
                    where: {
                        date: {
                            gte: today,
                            lt: tomorrow
                        },
                        category: {
                            in: ['Exam', 'Assignment', 'Project', 'Quiz']
                        }
                    }
                }
            }
        });

        for (const course of courses) {
            for (const grade of course.grades) {
                if (!grade.score || grade.score === 0) {
                    // Upcoming assignment (no score yet)
                    tasks.push({
                        id: `school:${course.id}:grade:${grade.id}`,
                        text: `${course.code}: ${grade.name}`,
                        completed: false,
                        priority: this.calculateSchoolPriority(grade.weight, grade.date),
                        source: 'school',
                        sourceId: course.id,
                        dueDate: grade.date,
                        metadata: {
                            courseCode: course.code,
                            category: grade.category
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
                        type: grade.category.toLowerCase() as 'assignment' | 'exam' | 'project',
                        courseName: course.name,
                        courseCode: course.code,
                        urgencyLevel,
                        weight: grade.weight
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
                await prisma.checklistItem.update({
                    where: { id: idParts[0] },
                    data: { completed }
                });
                break;

            case 'school':
                // School grades don't have a "completed" status
                // When user completes, we could create a checklist reminder to study
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
