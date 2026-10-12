import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { trackerEntrySchema } from '@/lib/schemas/tracker'
import { z } from 'zod'
import {
  createMutationFingerprint,
  IdempotencyConflictError,
  readIdempotencyKey,
  runIdempotentCreate,
  type IdempotencyDb,
} from '@/lib/server-idempotency'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const parsedBody = trackerEntrySchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.format() }, { status: 400 })
    }

    const { date, value } = parsedBody.data

    // Verify tracker belongs to user
    const tracker = await prisma.tracker.findFirst({
      where: {
        id,
        userId: session.user.id
      }
    })

    if (!tracker) {
      return NextResponse.json({ error: 'Tracker not found' }, { status: 404 })
    }

    const { key: idempotencyKey, invalid } = readIdempotencyKey(request)
    if (invalid) {
      return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 })
    }

    const fingerprint = createMutationFingerprint({ trackerId: id, date, value })
    let createdNewEntry = false

    const createOrUpdateEntry = async (db: IdempotencyDb) => {
      // Neon/Postgres advisory locks close the remaining race for two
      // different requests that log the same tracker/day at the same time.
      // The compound uniqueness invariant lives at the application boundary
      // today, so serialize that tiny critical section without deleting or
      // rewriting existing tracker data.
      if (typeof db.$executeRaw === 'function') {
        await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`novo:tracker-entry:${session.user.id}:${id}:${date}`}))`
      }

      // Tracker entries are an upsert by tracker/date. Keeping this lookup in
      // the same transaction as the idempotency record means a transport
      // retry can never create a second row for the same user intent.
      const existingEntry = await db.trackerEntry.findFirst({
        where: { trackerId: id, date },
      })

      if (existingEntry) {
        return db.trackerEntry.update({
          where: { id: existingEntry.id },
          data: { value },
        })
      }

      createdNewEntry = true
      return db.trackerEntry.create({
        data: { trackerId: id, date, value },
      })
    }

    const result = idempotencyKey
      ? await runIdempotentCreate(prisma, {
        userId: session.user.id,
        scope: 'tracker_entry',
        idempotencyKey,
        fingerprint,
        resourceType: 'tracker_entry',
        create: createOrUpdateEntry,
        findResource: (resourceId, db) => db.trackerEntry.findFirst({
          where: { id: resourceId, trackerId: id },
        }),
      })
      : {
        resource: await prisma.$transaction((transactionDb) => createOrUpdateEntry(transactionDb)),
        replay: false,
      }

    // Analytics is intentionally outside the database transaction. It is a
    // best-effort side effect and must not make a successful entry retry or
    // roll back; replays skip it because `createdNewEntry` stays false.
    if (createdNewEntry) {
      try {
        const { trackServerCompletion } = await import('@/lib/analytics-server')
        await trackServerCompletion(session.user.id, 'habit', 'trackers', {
          trackerId: id,
          trackerName: tracker.name,
          value,
          date,
        })
      } catch (analyticsError) {
        // The entry is already durable. Do not turn an analytics hiccup into a
        // false failed write that would make the client retry unnecessarily.
        console.error('Tracker entry analytics failed.')
      }
    }

    const response = NextResponse.json(result.resource, { status: result.replay ? 200 : 201 })
    response.headers.set('X-Idempotent-Replay', String(result.replay))
    return response
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    console.error('Error creating/updating tracker entry.')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')

    if (!date || isNaN(new Date(date).getTime())) {
      return NextResponse.json({ error: 'Valid date parameter is required' }, { status: 400 })
    }

    // Verify tracker belongs to user
    const tracker = await prisma.tracker.findFirst({
      where: {
        id,
        userId: session.user.id
      }
    })

    if (!tracker) {
      return NextResponse.json({ error: 'Tracker not found' }, { status: 404 })
    }

    await prisma.trackerEntry.deleteMany({
      where: {
        trackerId: id,
        date: date
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting tracker entry.')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
