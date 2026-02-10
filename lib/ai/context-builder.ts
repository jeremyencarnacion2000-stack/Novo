'use server';

import { prisma } from '@/lib/prisma';

/**
 * Context Builder - Definitive Novo Brain Specification
 * 
 * Builds a 3-layer memory context:
 * 1. User Profile (Stable)
 * 2. System State (Dynamic)
 * 3. Short-term (Session context)
 */

export interface UserContext {
    summary: string;
    tasks: any[];
    routines: any[];
    projects: any[];
}

export async function buildUserContext(userId: string): Promise<UserContext> {
    try {
        const [user, settings, tasks, routines, projects] = await Promise.all([
            prisma.user.findUnique({ where: { id: userId }, select: { name: true, bio: true } }),
            prisma.userSettings.findUnique({ where: { userId } }),
            prisma.task.findMany({ where: { userId, status: 'todo' }, take: 5 }),
            prisma.routine.findMany({ where: { userId, isActive: true }, take: 3 }),
            prisma.project.findMany({ where: { userId, status: 'in-progress' }, take: 2 })
        ]);

        // 1. USER PROFILE (Stable)
        const userProfile = `[USER PROFILE]
- Name: ${user?.name || 'User'}
- Bio/Context: ${user?.bio || 'No bio provided'}
- Preferences: ${settings?.preferences || 'Minimalist, calm tone'}
- Language: ${settings?.language || 'es'}`;

        // 2. SYSTEM STATE (Dynamic)
        const systemState = `[SYSTEM STATE]
- Active Tasks (${tasks.length}): ${tasks.map(t => t.title).join(', ') || 'None'}
- Active Routines (${routines.length}): ${routines.map(r => r.name).join(', ') || 'None'}
- Active Projects (${projects.length}): ${projects.map(p => p.title).join(', ') || 'None'}`;

        // 3. SHORT-TERM CONTEXT
        const shortTerm = `[SHORT-TERM CONTEXT]
- Session: Active
- Focus: Interaction with Novo Cognitive Core`;

        const summary = `
--- NOVO COGNITIVE CONTEXT ---
${userProfile}

${systemState}

${shortTerm}
--- END OF CONTEXT ---
`;

        return {
            summary,
            tasks,
            routines,
            projects
        };
    } catch (error) {
        console.error('[Context Builder] Error:', error);
        return {
            summary: 'Error loading context',
            tasks: [],
            routines: [],
            projects: []
        };
    }
}

/**
 * Builds a minimal context for quick queries
 */
export async function buildMinimalContext(userId: string): Promise<string> {
    try {
        const [taskCount, routineCount] = await Promise.all([
            prisma.task.count({ where: { userId, status: 'todo' } }),
            prisma.routine.count({ where: { userId, isActive: true } }),
        ]);

        return `Usuario tiene ${taskCount} tareas pendientes y ${routineCount} rutinas activas.`;
    } catch (error) {
        return '';
    }
}
