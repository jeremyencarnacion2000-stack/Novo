import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const conversations = await prisma.conversation.findMany({
      where: { userId: session.user.id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { updatedAt: 'desc' }
    })

    return NextResponse.json(conversations)
  } catch (error) {
    console.error('Error fetching conversations:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { title, messages } = await request.json()

    // Crear la conversación
    const conversation = await prisma.conversation.create({
      data: {
        userId: session.user.id,
        title: title || 'Nueva Conversación'
      }
    })

    // Si hay mensajes, crearlos
    if (messages && Array.isArray(messages)) {
      const messageData = messages.map((msg: any) => ({
        conversationId: conversation.id,
        role: msg.role,
        content: msg.content,
        createdAt: new Date(msg.timestamp || Date.now())
      }))

      await prisma.message.createMany({
        data: messageData
      })
    }

    // Retornar la conversación completa
    const fullConversation = await prisma.conversation.findUnique({
      where: { id: conversation.id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    })

    return NextResponse.json(fullConversation)
  } catch (error) {
    console.error('Error creating conversation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}