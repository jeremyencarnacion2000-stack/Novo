import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCanonicalTodoistTask } from '@/lib/todoist-provider-identity';
import { unlinkTodoistTask, rejectTodoistTask } from '@/lib/todoist-deterministic-linking';
import { linkTodoistTaskPersisted } from '@/lib/todoist-linking-prisma';

const linkSchema = z.object({ action: z.literal('link'), externalTaskId: z.string().min(1), internalEntityType: z.literal('task'), internalEntityId: z.string().min(1), connectionId: z.string().optional() });
const mutateSchema = z.object({ action: z.enum(['unlink', 'reject']), mappingId: z.string().min(1), reason: z.string().min(1).max(500) });

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body: unknown = await req.json().catch(() => null);
  const parsed = linkSchema.safeParse(body);
  if (parsed.success) {
    const account = await prisma.integrationAccount.findFirst({ where: { ...(parsed.data.connectionId ? { id: parsed.data.connectionId } : {}), userId: session.user.id, provider: 'todoist' } });
    if (!account || !account.providerAccountId || !account.accessToken || ['disconnected', 'revoked', 'reauth_required'].includes(String(account.syncStatus ?? '').toLowerCase())) return NextResponse.json({ error: 'todoist_connection_ineligible' }, { status: 403 });
    try {
      const result = await linkTodoistTaskPersisted({ userId: session.user.id, connectionId: account.id, taskId: parsed.data.externalTaskId, internalType: parsed.data.internalEntityType, internalId: parsed.data.internalEntityId }, async (connection, taskId) => getCanonicalTodoistTask((connection as { accessToken: string }).accessToken, taskId));
      return NextResponse.json(result, { status: 200 });
    } catch (error) { const message = error instanceof Error ? error.message : 'link_failed'; return NextResponse.json({ error: message }, { status: message.includes('conflict') ? 409 : 422 }); }
  }
  const mutation = mutateSchema.safeParse(body);
  if (!mutation.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const mapping = await prisma.externalEntityMapping.findFirst({ where: { id: mutation.data.mappingId, userId: session.user.id, provider: 'todoist' } });
  if (!mapping) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const result = mutation.data.action === 'unlink' ? await unlinkTodoistTask({ mappingId: mapping.id, userId: session.user.id, reason: mutation.data.reason }, { updateMapping: (input) => prisma.externalEntityMapping.update({ where: { id: mapping.id }, data: input as any }) }) : await rejectTodoistTask({ mappingId: mapping.id, userId: session.user.id, reason: mutation.data.reason }, { updateMapping: (input) => prisma.externalEntityMapping.update({ where: { id: mapping.id }, data: input as any }) });
  return NextResponse.json({ mapping: result });
}
