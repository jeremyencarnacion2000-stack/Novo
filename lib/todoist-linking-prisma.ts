import { prisma } from '@/lib/prisma';
import { linkTodoistTask, type LinkPorts, type TodoistTask } from './todoist-deterministic-linking';

/** Production ports for the deterministic Todoist link boundary. Canonical Ambient target is Task. */
export function createTodoistPrismaPorts(fetchTask: (connection: { accessToken: string }, taskId: string) => Promise<TodoistTask | null>): LinkPorts {
  return {
    getConnection: async (userId, connectionId) => {
      const row = await prisma.integrationAccount.findFirst({ where: { id: connectionId, userId, provider: 'todoist' } });
      const blocked = ['disconnected', 'revoked', 'reauth_required', 'error'];
      return row ? { id: row.id, userId: row.userId, provider: row.provider, providerAccountId: row.providerAccountId, status: blocked.includes(String(row.syncStatus ?? '').toLowerCase()) ? 'disconnected' : 'active', accessToken: row.accessToken } as any : null;
    },
    fetchTask: async (connection: any, taskId) => fetchTask(connection, taskId),
    ownsTarget: async (userId, internalType, internalId) => internalType === 'task' && !!(await prisma.task.findFirst({ where: { id: internalId, userId }, select: { id: true, status: true } })),
    findActive: async ({ userId, providerAccountId, sourceEntityId }) => {
      const row = await prisma.externalEntityMapping.findFirst({ where: { userId, provider: 'todoist', providerAccountId, entityType: 'task', sourceEntityId, status: 'active' }, select: { internalType: true, internalId: true } });
      return row;
    },
    saveMapping: async (input) => prisma.$transaction(async (tx) => {
      const existing = await tx.externalEntityMapping.findFirst({ where: { userId: input.userId as string, provider: 'todoist', providerAccountId: input.providerAccountId as string, entityType: 'task', sourceEntityId: input.sourceEntityId as string, status: 'active' } });
      if (existing) return existing;
      let mapping;
      try {
        mapping = await tx.externalEntityMapping.create({ data: input as any });
      } catch (error) {
        if ((error as { code?: string }).code !== 'P2002') throw error;
        mapping = await tx.externalEntityMapping.findFirst({ where: { userId: input.userId as string, provider: 'todoist', providerAccountId: input.providerAccountId as string, entityType: 'task', sourceEntityId: input.sourceEntityId as string, status: 'active' } });
        if (!mapping) throw error;
      }
      const baseline = input.canonicalBaseline as any;
      if (!baseline || typeof baseline.hash !== 'string') throw new Error('baseline_required');
      await tx.externalEntityBaseline.upsert({ where: { mappingId: mapping.id }, update: {
        normalizedState: baseline, stateHash: baseline.hash, observedAt: (input.lastObservedAt as Date) ?? new Date(),
      }, create: {
        mappingId: mapping.id,
        userId: input.userId as string,
        provider: 'todoist',
        providerAccountId: input.providerAccountId as string,
        sourceEntityId: input.sourceEntityId as string,
        normalizedState: baseline,
        stateHash: baseline.hash,
        observedAt: (input.lastObservedAt as Date) ?? new Date(),
      }});
      return mapping;
    }),
    updateMapping: async (input) => {
      const mapping = await prisma.externalEntityMapping.findFirst({ where: { id: input.id as string, userId: input.userId as string | undefined } })
      if (!mapping) throw new Error('mapping_not_owned')
      return prisma.externalEntityMapping.update({ where: { id: mapping.id }, data: input as any })
    },
  };
}

export async function linkTodoistTaskPersisted(input: Parameters<typeof linkTodoistTask>[0], fetchTask: (connection: { accessToken: string }, taskId: string) => Promise<TodoistTask | null>) {
  return linkTodoistTask(input, createTodoistPrismaPorts(fetchTask));
}
