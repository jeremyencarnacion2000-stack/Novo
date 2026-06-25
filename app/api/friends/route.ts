import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const friendActionSchema = z.object({
    targetUserId: z.string().min(1).max(200),
    action: z.enum(['request', 'accept', 'reject']),
})

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get all friendships where user is requester or addressee
        const friendships = await prisma.friendship.findMany({
            where: {
                OR: [
                    { requesterId: session.user.id },
                    { addresseeId: session.user.id }
                ]
            },
            include: {
                requester: { select: { id: true, name: true, image: true } },
                addressee: { select: { id: true, name: true, image: true } }
            }
        })

        return NextResponse.json(friendships)
    } catch (error) {
        console.error('Error fetching friendships:', error)
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
        const parsed = friendActionSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
        }

        const { targetUserId, action } = parsed.data

        if (action === 'request') {
            const existing = await prisma.friendship.findFirst({
                where: {
                    OR: [
                        { requesterId: session.user.id, addresseeId: targetUserId },
                        { requesterId: targetUserId, addresseeId: session.user.id }
                    ]
                }
            })

            if (existing) {
                return NextResponse.json({ error: 'Friendship already exists or pending' }, { status: 400 })
            }

            await prisma.friendship.create({
                data: {
                    requesterId: session.user.id,
                    addresseeId: targetUserId,
                    status: 'PENDING'
                }
            })
        } else if (action === 'accept' || action === 'reject') {
            // Find the pending request where current user is addressee
            const friendship = await prisma.friendship.findFirst({
                where: {
                    requesterId: targetUserId,
                    addresseeId: session.user.id,
                    status: 'PENDING'
                }
            })

            if (!friendship) {
                return NextResponse.json({ error: 'No pending request found' }, { status: 404 })
            }

            if (action === 'accept') {
                await prisma.friendship.update({
                    where: { id: friendship.id },
                    data: { status: 'ACCEPTED' }
                })
            } else {
                await prisma.friendship.delete({
                    where: { id: friendship.id }
                })
            }
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error managing friendship:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
