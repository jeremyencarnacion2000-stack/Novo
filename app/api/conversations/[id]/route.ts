import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { title, messages } = await request.json()

    // Verificar que la conversación pertenece al usuario
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        id: params.id,
        userId: session.user.id
      }
    })

    if (!existingConversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Actualizar la conversación
    const updatedConversation = await prisma.conversation.update({
      where: { id: params.id },
      data: {
        title: title || existingConversation.title,
        updatedAt: new Date()
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    })

    // Si hay mensajes nuevos, actualizarlos
    if (messages && Array.isArray(messages)) {
      // Primero eliminar mensajes existentes
      await prisma.message.deleteMany({
        where: { conversationId: params.id }
      })

      // Crear nuevos mensajes
      const messageData = messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
        createdAt: new Date(msg.timestamp || Date.now())
      }))

      await prisma.message.createMany({
        data: messageData.map(msg => ({
          ...msg,
          conversationId: params.id
        }))
      })

      // Recargar la conversación con mensajes
      const finalConversation = await prisma.conversation.findUnique({
        where: { id: params.id },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' }
          }
        }
      })

      return NextResponse.json(finalConversation)
    }

    return NextResponse.json(updatedConversation)
  } catch (error) {
    console.error('Error updating conversation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verificar que la conversación pertenece al usuario
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        id: params.id,
        userId: session.user.id
      }
    })

    if (!existingConversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Eliminar la conversación (los mensajes se eliminan automáticamente por cascade)
    await prisma.conversation.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting conversation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}