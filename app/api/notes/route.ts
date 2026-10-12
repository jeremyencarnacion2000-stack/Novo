import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createNoteSchema = z.object({
    content: z.string().min(1).max(50000),
    type: z.enum(['note', 'idea', 'task', 'reminder']).optional().default('note'),
    tags: z.array(z.string().max(50)).max(20).optional(),
    color: z.string().max(20).optional(),
    projectId: z.string().min(1).max(100).optional().nullable(),
    dueDate: z.string().max(100).optional().nullable(),
})

const NOTE_CREATE_SCOPE = 'note_create'
const IDEMPOTENCY_KEY_MAX_LENGTH = 128

function isUniqueConstraintError(error: unknown): error is { code: string } {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

function noteResponse(note: unknown, replay: boolean) {
    const response = NextResponse.json(note, { status: replay ? 200 : 201 })
    response.headers.set('X-Idempotent-Replay', String(replay))
    return response
}

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const archived = searchParams.get('archived') === 'true'
        const pinned = searchParams.get('pinned') === 'true'
        const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
        const skip = (page - 1) * limit

        const where = {
            userId: session.user.id,
            isArchived: archived,
            ...(searchParams.has('pinned') ? { isPinned: pinned } : {}),
        }

        const [notes, total] = await Promise.all([
            prisma.quickNote.findMany({
                where,
                orderBy: [
                    { isPinned: 'desc' },
                    { updatedAt: 'desc' }
                ],
                skip,
                take: limit,
            }),
            prisma.quickNote.count({ where }),
        ])

        const response = NextResponse.json(notes)
        response.headers.set('X-Total-Count', String(total))
        response.headers.set('X-Total-Pages', String(Math.ceil(total / limit)))
        response.headers.set('X-Page', String(page))
        return response
    } catch (error) {
        console.error('[NOTES_GET] Request failed.')
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const parsed = createNoteSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
        }

        const { content, type, tags, color, projectId, dueDate } = parsed.data
        if (projectId) {
            const ownedProject = await prisma.project.findFirst({
                where: { id: projectId, userId: session.user.id },
                select: { id: true },
            })
            if (!ownedProject) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
        }
        const rawIdempotencyKey = req.headers.get('Idempotency-Key')
        const idempotencyKey = rawIdempotencyKey?.trim() || null
        if (idempotencyKey && idempotencyKey.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
            return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 })
        }
        const fingerprint = JSON.stringify({ content, type, tags: tags || [], color: color || null, projectId: projectId || null, dueDate: dueDate || null })
        if (idempotencyKey) {
            const existing = await prisma.mutationRequest.findUnique({
                where: { userId_scope_idempotencyKey: { userId: session.user.id, scope: NOTE_CREATE_SCOPE, idempotencyKey } },
            })
            if (existing) {
                if (existing.fingerprint !== fingerprint) return NextResponse.json({ error: 'Idempotency key was already used for another request' }, { status: 409 })
                const existingNote = await prisma.quickNote.findFirst({ where: { id: existing.resourceId, userId: session.user.id } })
                if (existingNote) return noteResponse(existingNote, true)
                return NextResponse.json({ error: 'Idempotent request result is unavailable' }, { status: 409 })
            }
        }

        const createNote = (db: typeof prisma) => db.quickNote.create({
            data: {
                content,
                type,
                tags: tags || [],
                color,
                projectId,
                dueDate,
                userId: session.user.id
            },
        })

        if (!idempotencyKey) return noteResponse(await createNote(prisma), false)

        try {
            const note = await prisma.$transaction(async (tx) => {
                await tx.mutationRequest.create({
                    data: { userId: session.user.id, scope: NOTE_CREATE_SCOPE, idempotencyKey, fingerprint, resourceType: 'note', resourceId: 'pending' },
                })
                const created = await createNote(tx as typeof prisma)
                await tx.mutationRequest.update({
                    where: { userId_scope_idempotencyKey: { userId: session.user.id, scope: NOTE_CREATE_SCOPE, idempotencyKey } },
                    data: { resourceId: created.id },
                })
                return created
            })
            return noteResponse(note, false)
        } catch (error) {
            if (isUniqueConstraintError(error)) {
                const winner = await prisma.mutationRequest.findUnique({
                    where: { userId_scope_idempotencyKey: { userId: session.user.id, scope: NOTE_CREATE_SCOPE, idempotencyKey } },
                })
                if (winner && winner.fingerprint === fingerprint && winner.resourceId !== 'pending') {
                    const winnerNote = await prisma.quickNote.findFirst({ where: { id: winner.resourceId, userId: session.user.id } })
                    if (winnerNote) return noteResponse(winnerNote, true)
                }
            }
            throw error
        }
    } catch {
        console.error('[NOTES_POST] Creation failed.')
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
