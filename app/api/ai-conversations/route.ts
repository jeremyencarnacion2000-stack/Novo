import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const aiConversationSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  messages: z.any() // Assuming messages can be any JSON structure
})

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const conversations = await prisma.aIConversation.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
      take: 200
    })

    return NextResponse.json(conversations)
  } catch {
    console.error('Error fetching AI conversations.')
    return NextResponse.json({
      error: 'Unable to load AI conversations right now'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsedBody = aiConversationSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.format() }, { status: 400 })
    }

    const { id, title, messages } = parsedBody.data

    // The chat client creates a stable UUID before its debounced save. If the
    // request is delivered and the response is lost, the retry must converge
    // on that same row instead of surfacing a duplicate-key 500.
    if (id) {
      const existing = await prisma.aIConversation.findFirst({
        where: { id, userId: session.user.id },
      })
      if (existing) {
        const response = NextResponse.json(existing)
        response.headers.set('X-Idempotent-Replay', 'true')
        return response
      }
    }

    let conversation
    try {
      conversation = await prisma.aIConversation.create({
        data: {
          ...(id && { id }),
          title,
          messages,
          userId: session.user.id
        },
        select: { id: true, revision: true },
      })
    } catch (error) {
      if (id && isUniqueConstraintError(error)) {
        const winner = await prisma.aIConversation.findFirst({
          where: { id, userId: session.user.id },
        })
        if (winner) {
          const response = NextResponse.json(winner)
          response.headers.set('X-Idempotent-Replay', 'true')
          return response
        }
      }
      throw error
    }

    const response = NextResponse.json(conversation, { status: 201 })
    response.headers.set('X-Idempotent-Replay', 'false')
    return response
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating AI conversation.')
    return NextResponse.json({
      error: 'Unable to create an AI conversation right now'
    }, { status: 500 })
  }
}
