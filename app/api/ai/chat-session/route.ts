import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { withProviderSyncLock } from '@/lib/provider-sync-lock'
import { z } from 'zod'

const chatSessionSchema = z.object({
    messages: z.array(z.unknown()).max(200),
})

const MAX_SERIALIZED_MESSAGES = 1_000_000

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Find the most recent chat session for the user, or a specific one if we had IDs
        // For floating chat, we might just want a single persistent session or the latest one
        const chatSession = await prisma.chatSession.findFirst({
            where: { userId: session.user.id },
            orderBy: { updatedAt: 'desc' }
        })

        if (!chatSession) {
            return NextResponse.json({ messages: [] })
        }

        return NextResponse.json({
            id: chatSession.id,
            messages: JSON.parse(chatSession.messages)
        })
    } catch {
        console.error('Error fetching chat session.')
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const parsed = chatSessionSchema.safeParse(await request.json())
        if (!parsed.success) {
            return NextResponse.json({ error: 'Messages must be an array with at most 200 items' }, { status: 400 })
        }

        const serializedMessages = JSON.stringify(parsed.data.messages)
        if (serializedMessages.length > MAX_SERIALIZED_MESSAGES) {
            return NextResponse.json({ error: 'Chat history is too large' }, { status: 413 })
        }

        // The floating chat is intentionally one durable session per user.
        // Serialize the find-or-create window across serverless instances so
        // a double click or a lost response cannot create parallel sessions.
        const chatSession = await withProviderSyncLock(
            prisma,
            `floating-chat:${session.user.id}`,
            async (db) => {
                const existing = await db.chatSession.findFirst({
                    where: { userId: session.user.id },
                    orderBy: { updatedAt: 'desc' },
                })

                if (existing) {
                    return db.chatSession.update({
                        where: { id: existing.id },
                        data: {
                            messages: serializedMessages,
                            updatedAt: new Date(),
                        },
                    })
                }

                return db.chatSession.create({
                    data: {
                        userId: session.user.id,
                        title: 'Floating Chat',
                        messages: serializedMessages,
                    },
                })
            },
        )

        return NextResponse.json(chatSession)
    } catch (error) {
        console.error('Error saving chat session.')
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
