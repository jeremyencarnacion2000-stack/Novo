import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createNoteSchema = z.object({
    content: z.string().min(1).max(50000),
    tags: z.array(z.string().max(50)).max(20).optional(),
    color: z.string().max(20).optional(),
})

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return new NextResponse('Unauthorized', { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const archived = searchParams.get('archived') === 'true'
        const pinned = searchParams.get('pinned') === 'true'
        const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
        const skip = (page - 1) * limit

        const where = {
            userId: session.user.id,
            isArchived: archived,
            ...(searchParams.has('pinned') ? { isPinned: pinned } : {}),
        }

        const [notes, total] = await Promise.all([
            prisma.quickNote.findMany({
                where,
                orderBy: [
                    { isPinned: 'desc' },
                    { updatedAt: 'desc' }
                ],
                skip,
                take: limit,
            }),
            prisma.quickNote.count({ where }),
        ])

        const response = NextResponse.json(notes)
        response.headers.set('X-Total-Count', String(total))
        response.headers.set('X-Total-Pages', String(Math.ceil(total / limit)))
        response.headers.set('X-Page', String(page))
        return response
    } catch (error) {
        console.error('[NOTES_GET]', error)
        return new NextResponse('Internal Error', { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return new NextResponse('Unauthorized', { status: 401 })
        }

        const body = await req.json()
        const parsed = createNoteSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
        }

        const { content, tags, color } = parsed.data

        const note = await prisma.quickNote.create({
            data: {
                content,
                tags: tags || [],
                color,
                userId: session.user.id
            }
        })

        return NextResponse.json(note)
    } catch (error) {
        console.error('[NOTES_POST]', error)
        return new NextResponse('Internal Error', { status: 500 })
    }
}
