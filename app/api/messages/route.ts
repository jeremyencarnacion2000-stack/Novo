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
        console.error('Error fetching messages:', error)
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
        const { receiverId, content } = body

        const message = await prisma.directMessage.create({
            data: {
                senderId: session.user.id,
                receiverId,
                content
            }
        })

        return NextResponse.json(message)
    } catch (error) {
        console.error('Error sending message:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
