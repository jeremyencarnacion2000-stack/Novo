import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createMessageSchema = z.object({
    receiverId: z.string().min(1).max(200),
    content: z.string().min(1).max(5000),
})

const MESSAGE_CREATE_SCOPE = 'direct_message_create'
const IDEMPOTENCY_KEY_MAX_LENGTH = 128

function isUniqueConstraintError(error: unknown): error is { code: string } {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

function messageResponse(message: unknown, replay: boolean) {
    const response = NextResponse.json(message, { status: replay ? 200 : 201 })
    response.headers.set('X-Idempotent-Replay', String(replay))
    return response
}

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const otherUserId = searchParams.get('userId')

        if (!otherUserId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 })
        }

        const messages = await prisma.directMessage.findMany({
            where: {
                OR: [
                    { senderId: session.user.id, receiverId: otherUserId },
                    { senderId: otherUserId, receiverId: session.user.id }
                ]
            },
            orderBy: { createdAt: 'asc' },
            take: 50
        })

        return NextResponse.json(messages)
    } catch (error) {
        console.error('Error fetching messages.')
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const parsed = createMessageSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
        }

        const { receiverId, content } = parsed.data
        const receiver = await prisma.user.findUnique({ where: { id: receiverId }, select: { id: true } })
        if (!receiver) return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })

        const rawIdempotencyKey = request.headers.get('Idempotency-Key')
        const idempotencyKey = rawIdempotencyKey?.trim() || null
        if (idempotencyKey && idempotencyKey.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
            return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 })
        }

        const fingerprint = JSON.stringify({ receiverId, content })
        if (idempotencyKey) {
            const existing = await prisma.mutationRequest.findUnique({
                where: {
                    userId_scope_idempotencyKey: {
                        userId: session.user.id,
                        scope: MESSAGE_CREATE_SCOPE,
                        idempotencyKey,
                    },
                },
            })
            if (existing) {
                if (existing.fingerprint !== fingerprint) {
                    return NextResponse.json({ error: 'Idempotency key was already used for another message' }, { status: 409 })
                }
                const existingMessage = await prisma.directMessage.findFirst({
                    where: { id: existing.resourceId, senderId: session.user.id },
                })
                if (existingMessage) return messageResponse(existingMessage, true)
                return NextResponse.json({ error: 'Idempotent message result is unavailable' }, { status: 409 })
            }
        }

        const createMessage = (db: typeof prisma) => db.directMessage.create({
            data: { senderId: session.user.id, receiverId, content },
        })

        if (!idempotencyKey) return messageResponse(await createMessage(prisma), false)

        try {
            const message = await prisma.$transaction(async (tx) => {
                await tx.mutationRequest.create({
                    data: {
                        userId: session.user.id,
                        scope: MESSAGE_CREATE_SCOPE,
                        idempotencyKey,
                        fingerprint,
                        resourceType: 'direct_message',
                        resourceId: 'pending',
                    },
                })
                const created = await createMessage(tx as typeof prisma)
                await tx.mutationRequest.update({
                    where: {
                        userId_scope_idempotencyKey: {
                            userId: session.user.id,
                            scope: MESSAGE_CREATE_SCOPE,
                            idempotencyKey,
                        },
                    },
                    data: { resourceId: created.id },
                })
                return created
            })
            return messageResponse(message, false)
        } catch (error) {
            if (isUniqueConstraintError(error)) {
                const winner = await prisma.mutationRequest.findUnique({
                    where: {
                        userId_scope_idempotencyKey: {
                            userId: session.user.id,
                            scope: MESSAGE_CREATE_SCOPE,
                            idempotencyKey,
                        },
                    },
                })
                if (winner?.fingerprint === fingerprint && winner.resourceId !== 'pending') {
                    const winnerMessage = await prisma.directMessage.findFirst({
                        where: { id: winner.resourceId, senderId: session.user.id },
                    })
                    if (winnerMessage) return messageResponse(winnerMessage, true)
                }
            }
            throw error
        }
    } catch (error) {
        console.error('Error sending message.')
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
