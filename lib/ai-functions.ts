import { prisma } from './prisma';
import { calendarService, peopleService, booksService } from './google';
import { emailService } from './email';

// Function declarations for Gemini
export const AI_FUNCTION_DECLARATIONS = [
    {
        name: 'create_task',
        description: 'Create a new task in the system',
        parameters: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Task title' },
                priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Task priority' },
                dueDate: { type: 'string', description: 'Due date in YYYY-MM-DD format' },
                projectId: { type: 'string', description: 'Optional project ID to associate the task with' }
            },
            required: ['title']
        }
    },
    {
        name: 'list_tasks',
        description: 'Get a list of tasks with optional filters',
        parameters: {
            type: 'object',
            properties: {
                status: { type: 'string', enum: ['todo', 'in-progress', 'done'], description: 'Filter by status' },
                priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Filter by priority' },
                limit: { type: 'number', description: 'Maximum number of tasks to return' }
            }
        }
    },
    {
        name: 'update_task',
        description: 'Update an existing task',
        parameters: {
            type: 'object',
            properties: {
                taskId: { type: 'string', description: 'ID of the task to update' },
                title: { type: 'string', description: 'New task title' },
                status: { type: 'string', enum: ['todo', 'in-progress', 'done'], description: 'New status' },
                priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'New priority' }
            },
            required: ['taskId']
        }
    },
    {
        name: 'delete_task',
        description: 'Delete a task',
        parameters: {
            type: 'object',
            properties: {
                taskId: { type: 'string', description: 'ID of the task to delete' }
            },
            required: ['taskId']
        }
    },
    {
        name: 'create_project',
        description: 'Create a new project',
        parameters: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Project title' },
                description: { type: 'string', description: 'Project description' },
                priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Project priority' },
                dueDate: { type: 'string', description: 'Due date in YYYY-MM-DD format' }
            },
            required: ['title', 'description']
        }
    },
    {
        name: 'list_projects',
        description: 'Get a list of projects with optional filters',
        parameters: {
            type: 'object',
            properties: {
                status: { type: 'string', enum: ['not-started', 'in-progress', 'completed'], description: 'Filter by status' },
                limit: { type: 'number', description: 'Maximum number of projects to return' }
            }
        }
    },
    {
        name: 'create_habit',
        description: 'Create a new habit tracker',
        parameters: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Habit name' },
                type: { type: 'string', enum: ['habit', 'metric'], description: 'Tracker type' },
                unit: { type: 'string', description: 'Unit of measurement (e.g., "times", "minutes", "km")' },
                goal: { type: 'number', description: 'Goal value' }
            },
            required: ['name', 'type', 'unit', 'goal']
        }
    },
    {
        name: 'log_habit',
        description: 'Log a habit completion or metric value',
        parameters: {
            type: 'object',
            properties: {
                habitName: { type: 'string', description: 'Name of the habit to log' },
                value: { type: 'number', description: 'Value to log (1 for habit completion, actual value for metrics)' },
                date: { type: 'string', description: 'Date in YYYY-MM-DD format (defaults to today)' }
            },
            required: ['habitName', 'value']
        }
    },
    {
        name: 'get_analytics',
        description: 'Get productivity analytics and statistics',
        parameters: {
            type: 'object',
            properties: {
                days: { type: 'number', description: 'Number of days to include (default 30)' }
            }
        }
    },
    {
        name: 'get_current_date',
        description: 'Get the current date and time',
        parameters: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'gmail_send',
        description: 'Send an email using Gmail',
        parameters: {
            type: 'object',
            properties: {
                to: { type: 'string', description: 'Recipient email address' },
                subject: { type: 'string', description: 'Email subject' },
                body: { type: 'string', description: 'Email body (HTML supported)' }
            },
            required: ['to', 'subject', 'body']
        }
    },
    {
        name: 'calendar_list_events',
        description: 'List upcoming Google Calendar events',
        parameters: {
            type: 'object',
            properties: {
                limit: { type: 'number', description: 'Maximum number of events (default 10)' }
            }
        }
    },
    {
        name: 'calendar_create_event',
        description: 'Create a new event in Google Calendar',
        parameters: {
            type: 'object',
            properties: {
                summary: { type: 'string', description: 'Event title' },
                description: { type: 'string', description: 'Event description' },
                startTime: { type: 'string', description: 'Start time in ISO format (e.g., 2023-10-27T10:00:00)' },
                endTime: { type: 'string', description: 'End time in ISO format' }
            },
            required: ['summary', 'startTime', 'endTime']
        }
    },
    {
        name: 'fitness_get_steps',
        description: 'Get daily step count from Google Fit',
        parameters: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'fitness_get_workouts',
        description: 'Get recent workout routines from Google Fit',
        parameters: {
            type: 'object',
            properties: {
                days: { type: 'number', description: 'Number of days to look back (default 7)' }
            }
        }
    },
    {
        name: 'books_search',
        description: 'Search for books using Google Books API',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search query (title, author, etc.)' }
            },
            required: ['query']
        }
    },
    {
        name: 'people_list_contacts',
        description: 'List contacts from Google People API',
        parameters: {
            type: 'object',
            properties: {
                limit: { type: 'number', description: 'Maximum number of contacts (default 20)' }
            }
        }
    }
];

// Function execution handlers
export async function executeFunctionCall(
    functionName: string,
    args: Record<string, any>,
    userId: string
): Promise<{ success: boolean; message: string; data?: any }> {
    try {
        switch (functionName) {
            case 'create_task':
                return await createTask(args, userId);
            case 'list_tasks':
                return await listTasks(args, userId);
            case 'update_task':
                return await updateTask(args, userId);
            case 'delete_task':
                return await deleteTask(args, userId);
            case 'create_project':
                return await createProject(args, userId);
            case 'list_projects':
                return await listProjects(args, userId);
            case 'create_habit':
                return await createHabit(args, userId);
            case 'log_habit':
                return await logHabit(args, userId);
            case 'get_analytics':
                return await getAnalytics(args, userId);
            case 'get_current_date':
                return getCurrentDate();
            case 'gmail_send':
                return await emailService.sendFormattedReminder(args.to, args.subject, args.body)
                    .then(() => ({ success: true, message: 'Email sent successfully' }))
                    .catch((error: any) => ({ success: false, message: `Failed to send email: ${error.message}` }));
            case 'calendar_list_events':
                return await calendarService.listEvents(undefined, args.limit).then(data => ({ success: true, message: `Found ${data.length} events`, data }));
            case 'calendar_create_event':
                return await calendarService.createEvent(args.summary, args.description || '', args.startTime, args.endTime).then(data => ({ success: true, message: 'Event created', data }));
            case 'fitness_get_steps':
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
                const stepsEntry = await prisma.fitnessEntry.findFirst({
                    where: { userId, date: { gte: today, lt: tomorrow } }
                });
                return { success: true, message: `Today's steps: ${stepsEntry?.steps || 0}`, data: { steps: stepsEntry?.steps || 0 } };
            case 'fitness_get_workouts':
                const daysAgo = new Date();
                daysAgo.setDate(daysAgo.getDate() - (args.days || 7));
                const workouts = await prisma.workoutEntry.findMany({
                    where: { userId, date: { gte: daysAgo } },
                    orderBy: { date: 'desc' }
                });
                return { success: true, message: `Found ${workouts.length} workouts`, data: workouts };
            case 'books_search':
                return await booksService.searchBooks(args.query).then(data => ({ success: true, message: `Found ${data.length} books`, data }));
            case 'people_list_contacts':
                return await peopleService.listContacts(args.limit).then(data => ({ success: true, message: `Found ${data.length} contacts`, data }));
            default:
                return {
                    success: false,
                    message: `Unknown function: ${functionName}`
                };
        }
    } catch (error) {
        console.error(`Error executing ${functionName}:`, error);
        return {
            success: false,
            message: `Error: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

async function createTask(args: any, userId: string) {
    const task = await prisma.task.create({
        data: {
            userId,
            title: args.title,
            status: 'todo',
            priority: args.priority || 'medium',
            dueDate: args.dueDate || null,
            projectId: args.projectId || null,
            tags: '[]'
        }
    });

    return {
        success: true,
        message: `Task "${args.title}" created successfully with ID: ${task.id}`,
        data: task
    };
}

async function listTasks(args: any, userId: string) {
    const tasks = await prisma.task.findMany({
        where: {
            userId,
            ...(args.status && { status: args.status }),
            ...(args.priority && { priority: args.priority })
        },
        take: args.limit || 10,
        orderBy: { createdAt: 'desc' },
        include: {
            project: {
                select: {
                    title: true
                }
            }
        }
    });

    return {
        success: true,
        message: `Found ${tasks.length} task(s)`,
        data: tasks
    };
}

async function updateTask(args: any, userId: string) {
    // Verify task belongs to user
    const task = await prisma.task.findUnique({
        where: { id: args.taskId }
    });

    if (!task || task.userId !== userId) {
        return {
            success: false,
            message: 'Task not found or unauthorized'
        };
    }

    const updated = await prisma.task.update({
        where: { id: args.taskId },
        data: {
            ...(args.title && { title: args.title }),
            ...(args.status && { status: args.status }),
            ...(args.priority && { priority: args.priority })
        }
    });

    return {
        success: true,
        message: `Task updated successfully`,
        data: updated
    };
}

async function deleteTask(args: any, userId: string) {
    // Verify task belongs to user
    const task = await prisma.task.findUnique({
        where: { id: args.taskId }
    });

    if (!task || task.userId !== userId) {
        return {
            success: false,
            message: 'Task not found or unauthorized'
        };
    }

    await prisma.task.delete({
        where: { id: args.taskId }
    });

    return {
        success: true,
        message: `Task deleted successfully`
    };
}

async function createProject(args: any, userId: string) {
    const project = await prisma.project.create({
        data: {
            userId,
            title: args.title,
            description: args.description,
            status: 'not-started',
            priority: args.priority || 'medium',
            dueDate: args.dueDate || null,
            tags: '[]',
            notes: ''
        }
    });

    return {
        success: true,
        message: `Project "${args.title}" created successfully with ID: ${project.id}`,
        data: project
    };
}

async function listProjects(args: any, userId: string) {
    const projects = await prisma.project.findMany({
        where: {
            userId,
            ...(args.status && { status: args.status })
        },
        take: args.limit || 10,
        orderBy: { updatedAt: 'desc' },
        include: {
            tasks: {
                select: {
                    id: true,
                    title: true,
                    status: true
                }
            }
        }
    });

    return {
        success: true,
        message: `Found ${projects.length} project(s)`,
        data: projects
    };
}

async function createHabit(args: any, userId: string) {
    const tracker = await prisma.tracker.create({
        data: {
            userId,
            name: args.name,
            type: args.type,
            unit: args.unit,
            goal: args.goal
        }
    });

    return {
        success: true,
        message: `Habit "${args.name}" created successfully with ID: ${tracker.id}`,
        data: tracker
    };
}

async function logHabit(args: any, userId: string) {
    // Find the habit by name
    const tracker = await prisma.tracker.findFirst({
        where: {
            userId,
            name: args.habitName
        }
    });

    if (!tracker) {
        return {
            success: false,
            message: `Habit "${args.habitName}" not found`
        };
    }

    const date = args.date || new Date().toISOString().split('T')[0];

    const entry = await prisma.trackerEntry.create({
        data: {
            trackerId: tracker.id,
            date,
            value: args.value
        }
    });

    return {
        success: true,
        message: `Logged ${args.value} ${tracker.unit} for "${args.habitName}"`,
        data: entry
    };
}

async function getAnalytics(args: any, userId: string) {
    const days = args.days || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [tasks, dailyAnalytics] = await Promise.all([
        prisma.task.findMany({
            where: {
                userId,
                createdAt: { gte: startDate }
            },
            select: {
                status: true,
                priority: true
            }
        }),
        prisma.dailyAnalytics.findMany({
            where: {
                userId,
                date: { gte: startDate }
            }
        })
    ]);

    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const totalFocusTime = dailyAnalytics.reduce((sum, d) => sum + d.totalTime, 0);

    return {
        success: true,
        message: 'Analytics retrieved successfully',
        data: {
            totalTasks: tasks.length,
            completedTasks,
            inProgressTasks: tasks.filter(t => t.status === 'in-progress').length,
            totalFocusTimeSeconds: totalFocusTime,
            totalFocusTimeHours: Math.round(totalFocusTime / 3600 * 10) / 10,
            productiveDays: dailyAnalytics.filter(d => d.productivityScore > 0).length
        }
    };
}

function getCurrentDate() {
    const now = new Date();
    return {
        success: true,
        message: 'Current date and time',
        data: {
            date: now.toISOString().split('T')[0],
            time: now.toTimeString().split(' ')[0],
            datetime: now.toISOString(),
            dayOfWeek: now.toLocaleDateString('es-ES', { weekday: 'long' })
        }
    };
}
