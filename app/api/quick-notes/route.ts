import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const quickNoteSchema = z.object({ content: z.string().max(10_000) })
const QUICK_NOTE_SCOPE = 'focus_quick_note_upsert'

function isUniqueConstraint(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const note = await prisma.quickNote.findFirst({
            where: {
                userId: session.user.id,
                type: 'focus_note'
            },
            orderBy: { updatedAt: 'desc' }
        })

        return NextResponse.json({ content: note?.content || '' })
    } catch {
        console.error('Error fetching quick note')
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const parsed = quickNoteSchema.safeParse(await request.json().catch(() => null))
        if (!parsed.success) return NextResponse.json({ error: 'Invalid note content' }, { status: 400 })
        const { content } = parsed.data
        const idempotencyKey = request.headers.get('Idempotency-Key')?.trim() || null
        if (request.headers.has('Idempotency-Key') && (!idempotencyKey || idempotencyKey.length > 128)) {
            return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 })
        }
        const fingerprint = JSON.stringify({ content })

        if (idempotencyKey) {
            const existingMutation = await prisma.mutationRequest.findUnique({
                where: { userId_scope_idempotencyKey: { userId: session.user.id, scope: QUICK_NOTE_SCOPE, idempotencyKey } },
            })
            if (existingMutation) {
                if (existingMutation.fingerprint !== fingerprint) {
                    return NextResponse.json({ error: 'Idempotency key was already used for another request' }, { status: 409 })
                }
                const existingNote = await prisma.quickNote.findFirst({ where: { id: existingMutation.resourceId, userId: session.user.id, type: 'focus_note' } })
                if (existingNote) {
                    const response = NextResponse.json({ success: true, note: existingNote })
                    response.headers.set('X-Idempotent-Replay', 'true')
                    return response
                }
            }
        }

        try {
            const note = await prisma.$transaction(async (tx) => {
                const existing = await tx.quickNote.findFirst({ where: { userId: session.user.id, type: 'focus_note' }, orderBy: { updatedAt: 'desc' } })
                const saved = existing
                    ? await tx.quickNote.update({ where: { id: existing.id }, data: { content } })
                    : await tx.quickNote.create({ data: { userId: session.user.id, content, type: 'focus_note' } })
                if (idempotencyKey) {
                    await tx.mutationRequest.create({
                        data: { userId: session.user.id, scope: QUICK_NOTE_SCOPE, idempotencyKey, fingerprint, resourceType: 'quick_note', resourceId: saved.id },
                    })
                }
                return saved
            })
            const response = NextResponse.json({ success: true, note })
            response.headers.set('X-Idempotent-Replay', 'false')
            return response
        } catch (error) {
            if (idempotencyKey && isUniqueConstraint(error)) {
                const winner = await prisma.mutationRequest.findUnique({
                    where: { userId_scope_idempotencyKey: { userId: session.user.id, scope: QUICK_NOTE_SCOPE, idempotencyKey } },
                })
                if (winner && winner.fingerprint !== fingerprint) return NextResponse.json({ error: 'Idempotency key was already used for another request' }, { status: 409 })
                const existingNote = winner ? await prisma.quickNote.findFirst({ where: { id: winner.resourceId, userId: session.user.id, type: 'focus_note' } }) : null
                if (existingNote) {
                    const response = NextResponse.json({ success: true, note: existingNote })
                    response.headers.set('X-Idempotent-Replay', 'true')
                    return response
                }
            }
            throw error
        }
    } catch {
        console.error('Error saving quick note')
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
