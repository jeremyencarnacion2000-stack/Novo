import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateAiConversationSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  messages: z.any().optional() // Assuming messages can be any JSON structure
})

export async function PUT(
   request: NextRequest,
   { params }: { params: Promise<{ id: string }> }
 ) {
   try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

     const { id } = await params

    const body = await request.json()
    const parsedBody = updateAiConversationSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.format() }, { status: 400 })
    }

    const { title, messages } = parsedBody.data

    const updatedConversation = await prisma.aIConversation.update({
      where: {
        id,
        userId: session.user.id
      },
      data: {
        ...(title !== undefined && { title }),
        ...(messages !== undefined && { messages }),
      }
    })

    return NextResponse.json(updatedConversation)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error updating AI conversation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
   request: NextRequest,
   { params }: { params: Promise<{ id: string }> }
 ) {
   try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

     const { id } = await params

    const conversation = await prisma.aIConversation.deleteMany({
      where: {
        id,
        userId: session.user.id
      }
    })

    if (conversation.count === 0) {
      return NextResponse.json({ error: 'AI conversation not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting AI conversation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}