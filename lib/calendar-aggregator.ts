// Calendar Event Aggregator - Unifies events from all modules

import { prisma } from './prisma';
import { startOfDay, endOfDay, addDays, setHours, setMinutes } from 'date-fns';

export interface CalendarEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    allDay: boolean;
    source: 'google' | 'checklist' | 'project' | 'school' | 'routine' | 'habit' | 'business';
    color: string;
    metadata?: {
        projectId?: string;
        courseId?: string;
        routineId?: string;
        priority?: string;
        weight?: number;
        description?: string;
    };
}

// Color scheme for sources
const SOURCE_COLORS = {
    google: '#3b82f6',      // Blue
    checklist: '#0ea5e9',   // Sky
    project: '#10b981',     // Green
    school: '#8b5cf6',      // Purple
    routine: '#f97316',     // Orange
    habit: '#14b8a6',       // Teal
    business: '#ef4444',    // Red
};

export class CalendarAggregator {
    /**
     * Get all events for a date range from all sources
     */
    static async getEventsForRange(
        userId: string,
        start: Date,
        end: Date,
        sources?: string[]
    ): Promise<CalendarEvent[]> {
        const events: CalendarEvent[] = [];

        const enabledSources = sources || ['google', 'checklist', 'project', 'school', 'routine', 'habit', 'business'];

        // Fetch from all enabled sources in parallel
        const promises: Promise<CalendarEvent[]>[] = [];

        if (enabledSources.includes('google')) {
            promises.push(this.getGoogleEvents(userId, start, end));
        }
        if (enabledSources.includes('checklist')) {
            promises.push(this.getChecklistEvents(userId, start, end));
        }
        if (enabledSources.includes('project')) {
            promises.push(this.getProjectEvents(userId, start, end));
        }
        if (enabledSources.includes('school')) {
            promises.push(this.getSchoolEvents(userId, start, end));
        }
        if (enabledSources.includes('routine')) {
            promises.push(this.getRoutineEvents(userId, start, end));
        }
        if (enabledSources.includes('habit')) {
            promises.push(this.getHabitEvents(userId, start, end));
        }
        if (enabledSources.includes('business')) {
            promises.push(this.getBusinessEvents(userId, start, end));
        }

        const results = await Promise.all(promises);
        results.forEach(sourceEvents => events.push(...sourceEvents));

        // Sort by start date
        return events.sort((a, b) => a.start.getTime() - b.start.getTime());
    }

    /**
     * Get Business events (deals with expectedClose)
     */
    private static async getBusinessEvents(
        userId: string,
        start: Date,
        end: Date
    ): Promise<CalendarEvent[]> {
        const deals = await prisma.deal.findMany({
            where: {
                userId,
                expectedClose: {
                    gte: start,
                    lte: end,
                },
            },
            include: {
                client: true,
            },
        });

        return deals.map(deal => ({
            id: `business:deal:${deal.id}`,
            title: `🤝 Deal: ${deal.title} (${deal.client.name})`,
            start: startOfDay(deal.expectedClose!),
            end: endOfDay(deal.expectedClose!),
            allDay: true,
            source: 'business' as const,
            color: SOURCE_COLORS.business,
            metadata: {
                description: `Value: $${deal.value} | Stage: ${deal.stage} | Probability: ${deal.probability}%`,
            },
        }));
    }

    /**
     * Get Google Calendar events
     */
    private static async getGoogleEvents(
        userId: string,
        start: Date,
        end: Date
    ): Promise<CalendarEvent[]> {
        // TODO: Implement Google Calendar API integration
        // For now, return empty array
        // This will be populated when Google Calendar is properly integrated
        return [];
    }

    /**
     * Get Daily Checklist events (tasks with dueDate)
     */
    private static async getChecklistEvents(
        userId: string,
        start: Date,
        end: Date
    ): Promise<CalendarEvent[]> {
        const items = await prisma.checklistItem.findMany({
            where: {
                userId,
                dueDate: {
                    gte: start,
                    lte: end,
                },
            },
        });

        return items.map(item => ({
            id: `checklist:${item.id}`,
            title: item.text,
            start: startOfDay(item.dueDate!),
            end: endOfDay(item.dueDate!),
            allDay: true,
            source: 'checklist' as const,
            color: SOURCE_COLORS.checklist,
            metadata: {
                priority: item.priority,
            },
        }));
    }

    /**
     * Get Project events (subtasks with dueDate)
     */
    private static async getProjectEvents(
        userId: string,
        start: Date,
        end: Date
    ): Promise<CalendarEvent[]> {
        const projects = await prisma.project.findMany({
            where: {
                userId,
            },
            include: {
                subtasks: {
                    where: {
                        dueDate: {
                            gte: start,
                            lte: end,
                        },
                    },
                },
            },
        });

        const events: CalendarEvent[] = [];

        for (const project of projects) {
            for (const subtask of project.subtasks) {
                events.push({
                    id: `project:${project.id}:subtask:${subtask.id}`,
                    title: `${project.title}: ${subtask.title}`,
                    start: startOfDay(subtask.dueDate!),
                    end: endOfDay(subtask.dueDate!),
                    allDay: true,
                    source: 'project',
                    color: SOURCE_COLORS.project,
                    metadata: {
                        projectId: project.id,
                        priority: project.priority,
                    },
                });
            }
        }

        return events;
    }

    /**
     * Get School events (assignments and exams)
     */
    private static async getSchoolEvents(
        userId: string,
        start: Date,
        end: Date
    ): Promise<CalendarEvent[]> {
        const courses = await prisma.course.findMany({
            where: {
                userId,
            },
            include: {
                grades: {
                    where: {
                        date: {
                            gte: start,
                            lte: end,
                        },
                    },
                },
            },
        });

        const events: CalendarEvent[] = [];

        for (const course of courses) {
            for (const grade of course.grades) {
                // Show future assignments/exams (those without score yet or all)
                events.push({
                    id: `school:${course.id}:grade:${grade.id}`,
                    title: `${course.code}: ${grade.name}`,
                    start: startOfDay(grade.date),
                    end: endOfDay(grade.date),
                    allDay: true,
                    source: 'school',
                    color: SOURCE_COLORS.school,
                    metadata: {
                        courseId: course.id,
                        weight: grade.weight,
                        description: `${grade.category} - ${grade.weight}% of grade`,
                    },
                });
            }
        }

        return events;
    }

    /**
     * Get Routine events (recurring daily blocks)
     */
    private static async getRoutineEvents(
        userId: string,
        start: Date,
        end: Date
    ): Promise<CalendarEvent[]> {
        const routines = await prisma.routine.findMany({
            where: {
                userId,
                isActive: true,
            },
        });

        const events: CalendarEvent[] = [];

        // Day name mapping for daysOfWeek check
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

        // Generate routine blocks for each day in range
        let currentDate = new Date(start);
        while (currentDate <= end) {
            const currentDayName = dayNames[currentDate.getDay()];

            for (const routine of routines) {
                // Check if routine is scheduled for this day of week
                if (routine.daysOfWeek) {
                    try {
                        const scheduledDays = JSON.parse(routine.daysOfWeek) as string[];
                        if (!scheduledDays.includes(currentDayName)) {
                            continue; // Skip this routine for this day
                        }
                    } catch {
                        // If parsing fails, include the routine anyway
                    }
                }

                let eventStart: Date;
                let eventEnd: Date;

                // Use scheduledTime if available, otherwise fall back to timeOfDay
                if (routine.scheduledTime) {
                    const [hours, minutes] = routine.scheduledTime.split(':').map(Number);
                    eventStart = setHours(setMinutes(new Date(currentDate), minutes || 0), hours);
                    eventEnd = new Date(eventStart.getTime() + routine.duration * 60 * 1000);
                } else {
                    let startHour: number;

                    // Map timeOfDay to hours
                    switch (routine.timeOfDay) {
                        case 'morning':
                            startHour = 6;
                            break;
                        case 'afternoon':
                            startHour = 12;
                            break;
                        case 'evening':
                            startHour = 18;
                            break;
                        case 'anytime':
                        default:
                            // Skip anytime routines without scheduledTime for calendar
                            continue;
                    }

                    eventStart = setHours(setMinutes(new Date(currentDate), 0), startHour);
                    eventEnd = new Date(eventStart.getTime() + routine.duration * 60 * 1000);
                }

                events.push({
                    id: `routine:${routine.id}:${currentDate.toISOString().split('T')[0]}`,
                    title: routine.name,
                    start: eventStart,
                    end: eventEnd,
                    allDay: false,
                    source: 'routine',
                    color: SOURCE_COLORS.routine,
                    metadata: {
                        routineId: routine.id,
                        description: routine.description,
                    },
                });
            }

            currentDate = addDays(currentDate, 1);
        }

        return events;
    }

    /**
     * Get Habit events (habit check-ins)
     */
    private static async getHabitEvents(
        userId: string,
        start: Date,
        end: Date
    ): Promise<CalendarEvent[]> {
        const trackers = await prisma.tracker.findMany({
            where: {
                userId,
                type: 'habit',
            },
            include: {
                entries: {
                    where: {
                        // Assuming date is stored as string in format YYYY-MM-DD
                        // We'll need to filter in memory for now
                    },
                },
            },
        });

        const events: CalendarEvent[] = [];

        for (const tracker of trackers) {
            for (const entry of tracker.entries) {
                const entryDate = new Date(entry.date);

                // Check if entry is in range
                if (entryDate >= start && entryDate <= end) {
                    // Only show completed habits (value > 0)
                    if (entry.value > 0) {
                        events.push({
                            id: `habit:${tracker.id}:entry:${entry.id}`,
                            title: `✓ ${tracker.name}`,
                            start: startOfDay(entryDate),
                            end: endOfDay(entryDate),
                            allDay: true,
                            source: 'habit',
                            color: SOURCE_COLORS.habit,
                            metadata: {
                                description: `Completed ${tracker.name}`,
                            },
                        });
                    }
                }
            }
        }

        return events;
    }
}
