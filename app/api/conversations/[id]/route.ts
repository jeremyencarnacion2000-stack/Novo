import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { updateConversationSchema, conversationMessageSchema } from '@/lib/schemas/conversation'
import { z } from 'zod'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsedBody = updateConversationSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.format() }, { status: 400 })
    }

    const { title, messages } = parsedBody.data

    // Verificar que la conversación pertenece al usuario
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        id,
        userId: session.user.id
      }
    })

    if (!existingConversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Actualizar la conversación
    const updatedConversation = await prisma.conversation.update({
      where: { id },
      data: {
        title: title || existingConversation.title,
        updatedAt: new Date(),
        messages: {
          upsert: messages?.map((msg) => ({
            where: { id: msg.id || '' },
            update: { role: msg.role, content: msg.content, createdAt: msg.createdAt ? new Date(msg.createdAt) : undefined },
            create: { role: msg.role, content: msg.content, createdAt: msg.createdAt ? new Date(msg.createdAt) : undefined },
          })),
        },
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    })

    return NextResponse.json(updatedConversation)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error updating conversation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verificar que la conversación pertenece al usuario
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        id,
        userId: session.user.id
      }
    })

    if (!existingConversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Eliminar la conversación (los mensajes se eliminan automáticamente por cascade)
    await prisma.conversation.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting conversation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}