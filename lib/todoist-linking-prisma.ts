import { prisma } from '@/lib/prisma';
import { linkTodoistTask, type LinkPorts, type TodoistTask } from './todoist-deterministic-linking';

/** Production ports for the deterministic Todoist link boundary. Canonical target is ChecklistItem. */
export function createTodoistPrismaPorts(fetchTask: (connection: { accessToken: string }, taskId: string) => Promise<TodoistTask | null>): LinkPorts {
  return {
    getConnection: async (userId, connectionId) => {
      const row = await prisma.integrationAccount.findFirst({ where: { id: connectionId, userId, provider: 'todoist' } });
      return row ? { id: row.id, userId: row.userId, provider: row.provider, providerAccountId: row.providerAccountId, status: row.syncStatus === 'disconnected' ? 'disconnected' : 'active', accessToken: row.accessToken } as any : null;
    },
    fetchTask: async (connection: any, taskId) => fetchTask(connection, taskId),
    ownsTarget: async (userId, internalType, internalId) => internalType === 'ChecklistItem' && !!(await prisma.checklistItem.findFirst({ where: { id: internalId, userId }, select: { id: true } })),
    findActive: async ({ userId, providerAccountId, sourceEntityId }) => {
      const row = await prisma.externalEntityMapping.findFirst({ where: { userId, provider: 'todoist', providerAccountId, entityType: 'task', sourceEntityId, status: 'active' }, select: { internalType: true, internalId: true } });
      return row;
    },
    saveMapping: async (input) => prisma.$transaction(async (tx) => {
      const existing = await tx.externalEntityMapping.findFirst({ where: { userId: input.userId as string, provider: 'todoist', providerAccountId: input.providerAccountId as string, entityType: 'task', sourceEntityId: input.sourceEntityId as string, status: 'active' } });
      if (existing) return existing;
      return tx.externalEntityMapping.create({ data: input as any });
    }),
    updateMapping: async (input) => prisma.externalEntityMapping.update({ where: { id: input.id as string }, data: input as any }),
  };
}

export async function linkTodoistTaskPersisted(input: Parameters<typeof linkTodoistTask>[0], fetchTask: (connection: { accessToken: string }, taskId: string) => Promise<TodoistTask | null>) {
  return linkTodoistTask(input, createTodoistPrismaPorts(fetchTask));
}
