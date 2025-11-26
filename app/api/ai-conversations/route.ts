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

    const conversations = await prisma.aIConversation.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' }
    })

    return NextResponse.json(conversations)
  } catch (error) {
    console.error('Error fetching AI conversations:', error)
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
    const { title, messages } = body

    if (!title || !messages) {
      return NextResponse.json({ error: 'Title and messages are required' }, { status: 400 })
    }

    const conversation = await prisma.aIConversation.create({
      data: {
        title,
        messages,
        userId: session.user.id
      }
    })

    return NextResponse.json(conversation, { status: 201 })
  } catch (error) {
    console.error('Error creating AI conversation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}