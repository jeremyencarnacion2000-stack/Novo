import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const aiConversationSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  messages: z.any() // Assuming messages can be any JSON structure
})

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
     const parsedBody = aiConversationSchema.safeParse(body)

     if (!parsedBody.success) {
       return NextResponse.json({ error: parsedBody.error.format() }, { status: 400 })
     }

     const { title, messages } = parsedBody.data

     const conversation = await prisma.aIConversation.create({
       data: {
         title,
         messages,
         userId: session.user.id
       }
    })

    return NextResponse.json(conversation, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating AI conversation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
