import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { conversationMessageSchema } from '@/lib/schemas/conversation'
import { z } from 'zod'

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const conversationId = params.id
        const body = await request.json()
        const parsedBody = conversationMessageSchema.safeParse(body)

        if (!parsedBody.success) {
            return NextResponse.json({ error: parsedBody.error.format() }, { status: 400 })
        }

        const { role, content, createdAt } = parsedBody.data

        // Verify conversation belongs to user
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId }
        })

        if (!conversation || conversation.userId !== session.user.id) {
            return NextResponse.json({ error: 'Conversation not found or unauthorized' }, { status: 404 })
        }

        // Create message
        const message = await prisma.message.create({
            data: {
                conversationId,
                role,
                content,
                createdAt: createdAt ? new Date(createdAt) : new Date()
            }
        })

        // Update conversation timestamp
        await prisma.conversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() }
        })

        return NextResponse.json(message)
    } catch (error) {
        console.error('Error creating message:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
