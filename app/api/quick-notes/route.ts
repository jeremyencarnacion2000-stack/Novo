import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const note = await prisma.quickNote.findFirst({
            where: {
                userId: session.user.id,
                type: 'focus_note'
            },
            orderBy: { updatedAt: 'desc' }
        })

        return NextResponse.json({ content: note?.content || '' })
    } catch (error) {
        console.error('Error fetching quick note:', error)
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
        const { content } = body

        // Upsert the focus note
        const note = await prisma.quickNote.findFirst({
            where: {
                userId: session.user.id,
                type: 'focus_note'
            }
        })

        if (note) {
            await prisma.quickNote.update({
                where: { id: note.id },
                data: { content }
            })
        } else {
            await prisma.quickNote.create({
                data: {
                    userId: session.user.id,
                    content,
                    type: 'focus_note'
                }
            })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error saving quick note:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
