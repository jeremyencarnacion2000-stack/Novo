import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const businessClientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  status: z.enum(['active', 'proposal', 'inactive']).optional().default('proposal'),
  projects: z.number().int().min(0).optional().default(0)
})

const businessContentIdeaSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  platform: z.string().optional().default('Blog'),
  status: z.enum(['draft', 'scheduled', 'published']).optional().default('draft')
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    if (type === 'clients') {
      const clients = await prisma.businessClient.findMany({
        where: { userId: session.user.id },
        orderBy: { updatedAt: 'desc' }
      })
      return NextResponse.json(clients)
    } else if (type === 'content') {
      const content = await prisma.businessContentIdea.findMany({
        where: { userId: session.user.id },
        orderBy: { updatedAt: 'desc' }
      })
      return NextResponse.json(content)
    } else {
      return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error fetching business data:', error)
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
    const { type, ...data } = body

    if (type === 'clients') {
      const parsedBody = businessClientSchema.safeParse(data)
      if (!parsedBody.success) {
        return NextResponse.json({ error: parsedBody.error.format() }, { status: 400 })
      }

      const { name, status, projects } = parsedBody.data
      const client = await prisma.businessClient.create({
        data: {
          name,
          status,
          projects,
          userId: session.user.id
        }
      })

      return NextResponse.json(client, { status: 201 })
    } else if (type === 'content') {
      const parsedBody = businessContentIdeaSchema.safeParse(data)
      if (!parsedBody.success) {
        return NextResponse.json({ error: parsedBody.error.format() }, { status: 400 })
      }

      const { title, platform, status } = parsedBody.data
      const content = await prisma.businessContentIdea.create({
        data: {
          title,
          platform,
          status,
          userId: session.user.id
        }
      })

      return NextResponse.json(content, { status: 201 })
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating business data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const type = searchParams.get('type')

    if (!id || !type) {
      return NextResponse.json({ error: 'ID and type are required' }, { status: 400 })
    }

    if (type === 'clients') {
      await prisma.businessClient.deleteMany({
        where: { id, userId: session.user.id }
      })
    } else if (type === 'content') {
      await prisma.businessContentIdea.deleteMany({
        where: { id, userId: session.user.id }
      })
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting business data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}