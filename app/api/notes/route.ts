import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return new NextResponse('Unauthorized', { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const archived = searchParams.get('archived') === 'true'
        const pinned = searchParams.get('pinned') === 'true'

        const notes = await prisma.quickNote.findMany({
            where: {
                userId: session.user.id,
                isArchived: archived,
                ...(searchParams.has('pinned') ? { isPinned: pinned } : {}),
            },
            orderBy: [
                { isPinned: 'desc' },
                { updatedAt: 'desc' }
            ]
        })

        return NextResponse.json(notes)
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
        const { content, tags, color } = body

        if (!content) {
            return new NextResponse('Content is required', { status: 400 })
        }

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
