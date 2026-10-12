import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const note = await prisma.quickNote.findUnique({
            where: {
                id,
                userId: session.user.id
            }
        })

        if (!note) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        return NextResponse.json(note)
    } catch (error) {
        console.error('[NOTE_GET] Request failed.')
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const { content, isPinned, isArchived, color, tags } = body

        const note = await prisma.quickNote.update({
            where: {
                id,
                userId: session.user.id
            },
            data: {
                content,
                isPinned,
                isArchived,
                color,
                tags
            }
        })

        return NextResponse.json(note)
    } catch (error) {
        console.error('[NOTE_PATCH] Request failed.')
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        await prisma.quickNote.delete({
            where: {
                id,
                userId: session.user.id
            }
        })

        return new NextResponse(null, { status: 204 })
    } catch (error) {
        console.error('[NOTE_DELETE] Request failed.')
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
