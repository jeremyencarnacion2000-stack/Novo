import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
    const { title, messages } = body

    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (messages !== undefined) updateData.messages = messages

    const conversation = await prisma.aIConversation.updateMany({
      where: {
        id,
        userId: session.user.id
      },
      data: updateData
    })

    if (conversation.count === 0) {
      return NextResponse.json({ error: 'AI conversation not found' }, { status: 404 })
    }

    const updatedConversation = await prisma.aIConversation.findUnique({
      where: { id }
    })

    return NextResponse.json(updatedConversation)
  } catch (error) {
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