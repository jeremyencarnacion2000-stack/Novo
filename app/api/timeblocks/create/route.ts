import { createHash } from 'node:crypto';
import { google } from 'googleapis';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const timeBlockSchema = z.object({
  title: z.string().trim().min(1).max(240),
  type: z.string().trim().min(1).max(80),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  projectId: z.string().cuid().optional().nullable(),
  routineId: z.string().cuid().optional().nullable(),
  energyRequired: z.enum(['high', 'medium', 'low']).optional(),
}).refine((value) => new Date(value.endTime).getTime() > new Date(value.startTime).getTime(), {
  message: 'endTime must be after startTime',
  path: ['endTime'],
});

const TIME_BLOCK_SCOPE = 'timeblock_create';

function isUniqueConstraint(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

function deterministicGoogleEventId(idempotencyKey: string) {
  // Google Calendar event IDs use a restricted alphabet; a lowercase hex
  // digest keeps retries deterministic without exposing the client key.
  return `novo${createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 40)}`;
}

type TimeBlockRecord = {
  id: string;
  title: string;
  type: string;
  startTime: Date;
  endTime: Date;
  energyRequired: string;
  googleEventId: string | null;
};

/**
 * Best-effort provider sync that is safe to call on both the first request and
 * an idempotent replay. A local block can survive a transient Google failure;
 * the next replay then retries the same deterministic event ID instead of
 * returning early and leaving the external calendar permanently stale.
 */
async function syncTimeBlockToGoogle(
  userId: string,
  timeBlock: TimeBlockRecord,
  idempotencyKey: string | null,
): Promise<TimeBlockRecord> {
  const account = await prisma.account.findFirst({ where: { userId, provider: 'google' } });
  if (!account?.access_token || timeBlock.googleEventId) return timeBlock;

  try {
    const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    oauth2Client.setCredentials({ access_token: account.access_token, refresh_token: account.refresh_token });
    oauth2Client.on('tokens', async (tokens) => {
      if (!tokens.access_token) return;
      await prisma.account.update({
        where: { id: account.id },
        data: {
          access_token: tokens.access_token,
          expires_at: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : undefined,
          refresh_token: tokens.refresh_token ?? undefined,
        },
      });
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const deterministicId = idempotencyKey ? deterministicGoogleEventId(idempotencyKey) : undefined;
    const requestBody: {
      id?: string;
      summary: string;
      description: string;
      start: { dateTime: string };
      end: { dateTime: string };
    } = {
      ...(deterministicId ? { id: deterministicId } : {}),
      summary: timeBlock.title,
      description: `Novo Heritage TimeBlock: ${timeBlock.type} (Energy: ${timeBlock.energyRequired})`,
      start: { dateTime: timeBlock.startTime.toISOString() },
      end: { dateTime: timeBlock.endTime.toISOString() },
    };

    let googleEventId: string | null = null;
    try {
      const googleEvent = await calendar.events.insert({ calendarId: 'primary', requestBody });
      googleEventId = googleEvent.data.id || deterministicId || null;
    } catch (error) {
      // A deterministic 409 means a previous attempt already created the
      // same Calendar event; do not create a second event on retry.
      if (deterministicId && (error as { code?: number }).code === 409) googleEventId = deterministicId;
      else throw error;
    }

    if (!googleEventId) return timeBlock;
    return await prisma.timeBlock.update({ where: { id: timeBlock.id }, data: { googleEventId } });
  } catch {
    console.error('[TimeBlock] Google Calendar write failed; local block retained.');
    return timeBlock;
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = timeBlockSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid time block details' }, { status: 400 });
    const { title, type, startTime, endTime, projectId, routineId, energyRequired } = parsed.data;
    const rawIdempotencyKey = request.headers.get('Idempotency-Key');
    const idempotencyKey = rawIdempotencyKey?.trim() || null;
    if (rawIdempotencyKey !== null && (!idempotencyKey || idempotencyKey.length > 128)) {
      return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 });
    }
    const fingerprint = JSON.stringify({ title, type, startTime, endTime, projectId: projectId ?? null, routineId: routineId ?? null, energyRequired: energyRequired ?? 'medium' });

    // Relation IDs are user-owned resources; never allow a foreign project or
    // routine to be attached to a new time block.
    const [project, routine] = await Promise.all([
      projectId ? prisma.project.findFirst({ where: { id: projectId, userId: session.user.id }, select: { id: true } }) : null,
      routineId ? prisma.routine.findFirst({ where: { id: routineId, userId: session.user.id }, select: { id: true } }) : null,
    ]);
    if (projectId && !project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (routineId && !routine) return NextResponse.json({ error: 'Routine not found' }, { status: 404 });

    if (idempotencyKey) {
      const existingMutation = await prisma.mutationRequest.findUnique({
        where: { userId_scope_idempotencyKey: { userId: session.user.id, scope: TIME_BLOCK_SCOPE, idempotencyKey } },
      });
      if (existingMutation) {
        if (existingMutation.fingerprint !== fingerprint) return NextResponse.json({ error: 'Idempotency key was already used for another request' }, { status: 409 });
        const existingBlock = await prisma.timeBlock.findFirst({ where: { id: existingMutation.resourceId, userId: session.user.id } });
        if (existingBlock) {
          const syncedBlock = await syncTimeBlockToGoogle(session.user.id, existingBlock, idempotencyKey);
          const response = NextResponse.json(syncedBlock);
          response.headers.set('X-Idempotent-Replay', 'true');
          return response;
        }
      }
    }

    let timeBlock;
    try {
      // Reserve the local resource before any provider write. If Google times
      // out, a retry can safely find this row and retry the same event ID.
      timeBlock = await prisma.$transaction(async (tx) => {
        const created = await tx.timeBlock.create({
          data: {
            title,
            type,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            projectId: projectId || null,
            routineId: routineId || null,
            energyRequired: energyRequired || 'medium',
            userId: session.user.id,
            status: 'pending',
          },
        });
        if (idempotencyKey) {
          await tx.mutationRequest.create({
            data: { userId: session.user.id, scope: TIME_BLOCK_SCOPE, idempotencyKey, fingerprint, resourceType: 'time_block', resourceId: created.id },
          });
        }
        return created;
      });
    } catch (error) {
      if (idempotencyKey && isUniqueConstraint(error)) {
        const winner = await prisma.mutationRequest.findUnique({
          where: { userId_scope_idempotencyKey: { userId: session.user.id, scope: TIME_BLOCK_SCOPE, idempotencyKey } },
        });
        if (winner && winner.fingerprint !== fingerprint) return NextResponse.json({ error: 'Idempotency key was already used for another request' }, { status: 409 });
        if (winner) {
          const existingBlock = await prisma.timeBlock.findFirst({ where: { id: winner.resourceId, userId: session.user.id } });
          if (existingBlock) {
            const syncedBlock = await syncTimeBlockToGoogle(session.user.id, existingBlock, idempotencyKey);
            const response = NextResponse.json(syncedBlock);
            response.headers.set('X-Idempotent-Replay', 'true');
            return response;
          }
        }
      }
      throw error;
    }

    timeBlock = await syncTimeBlockToGoogle(session.user.id, timeBlock, idempotencyKey);

    const response = NextResponse.json(timeBlock, { status: 201 });
    response.headers.set('X-Idempotent-Replay', 'false');
    return response;
  } catch {
    console.error('💥 [API Create] Error creating time block.');
    return NextResponse.json({ error: 'Failed to create time block' }, { status: 500 });
  }
}
