import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import {canonicalConversationMessages,conversationMessagesSchema,saveConversationRevision} from '@/lib/ai/conversation-revision'
import {mergeConversationMessages} from '@/lib/ai/conversation-messages'
import {CompanionError} from '@/lib/companion/auth'

const updateAiConversationSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  messages: conversationMessagesSchema.optional(),
  expectedRevision: z.number().int().nonnegative().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const conversation = await prisma.aIConversation.findUnique({
      where: {
        id,
        userId: session.user.id
      }
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    return NextResponse.json(conversation)
  } catch {
    console.error('Error fetching AI conversation.')
    return NextResponse.json({
      error: 'Unable to load this AI conversation right now'
    }, { status: 500 })
  }
}

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

    const { title, messages, expectedRevision } = parsedBody.data
    const needsStoredMessages = messages === undefined || expectedRevision === undefined
    const current = await prisma.aIConversation.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true, revision: true, createdAt: true, messages: needsStoredMessages },
    })
    if(!current)return NextResponse.json({error:'Conversation not found'},{status:404})
    if(expectedRevision!==undefined && expectedRevision!==current.revision)return NextResponse.json({error:'revision_conflict',revision:current.revision},{status:409})
    const stored=needsStoredMessages?canonicalConversationMessages(id,current.messages,current.createdAt.toISOString()):[]
    // Legacy tabs have no revision. Preserve unseen server messages instead of
    // allowing an old full-cache autosave to erase a Companion review card.
    const next=messages===undefined?stored:expectedRevision===undefined?mergeConversationMessages(stored,messages):messages
    const saved=await saveConversationRevision(session.user.id,id,current.revision,next,title)
    return NextResponse.json({id:current.id,revision:saved.revision})
  } catch (error: any) {
    if(error instanceof CompanionError)return NextResponse.json({error:error.code},{status:error.status})
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    // Prisma Record Not Found error code
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    console.error('Error updating AI conversation.');

    return NextResponse.json({
      error: 'Unable to update this AI conversation right now'
    }, { status: 500 })
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
  } catch {
    console.error('Error deleting AI conversation.')
    return NextResponse.json({
      error: 'Unable to delete this AI conversation right now'
    }, { status: 500 })
  }
}
