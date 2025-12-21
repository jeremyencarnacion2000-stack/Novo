import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
    } catch (error) {
        console.error('Error fetching chat session:', error)
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
        const { messages } = body

        if (!Array.isArray(messages)) {
            return NextResponse.json({ error: 'Messages must be an array' }, { status: 400 })
        }

        // Upsert the chat session (or create a new one if we want history)
        // For now, let's keep a single "Floating Chat" session updated
        const chatSession = await prisma.chatSession.findFirst({
            where: { userId: session.user.id },
            orderBy: { updatedAt: 'desc' }
        })

        if (chatSession) {
            const updated = await prisma.chatSession.update({
                where: { id: chatSession.id },
                data: {
                    messages: JSON.stringify(messages),
                    updatedAt: new Date()
                }
            })
            return NextResponse.json(updated)
        } else {
            const created = await prisma.chatSession.create({
                data: {
                    userId: session.user.id,
                    title: 'Floating Chat',
                    messages: JSON.stringify(messages)
                }
            })
            return NextResponse.json(created)
        }
    } catch (error) {
        console.error('Error saving chat session:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
