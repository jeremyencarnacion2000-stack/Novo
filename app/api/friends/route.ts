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
    } catch {
        // Keep database/provider diagnostics out of logs and the response.
        console.error('[friends] Fetch failed.')
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
            // A friendship must connect two distinct accounts. Reject this
            // before the lookup so a malformed/self request cannot create a
            // row that later appears twice in both sides of the social UI.
            if (targetUserId === session.user.id) {
                return NextResponse.json({ error: 'You cannot send a friend request to yourself' }, { status: 400 })
            }

            const existing = await prisma.friendship.findFirst({
                where: {
                    OR: [
                        { requesterId: session.user.id, addresseeId: targetUserId },
                        { requesterId: targetUserId, addresseeId: session.user.id }
                    ]
                }
            })

            if (existing) {
                // A retry of the same client intent must be safe after a lost
                // response. A reverse-direction request is a different user
                // action (the current user should accept it), so keep that as
                // an actionable conflict instead of claiming it succeeded.
                if (existing.requesterId === session.user.id && existing.addresseeId === targetUserId) {
                    return NextResponse.json({ success: true, replay: true, status: existing.status })
                }
                return NextResponse.json({ error: 'Friendship already exists or pending' }, { status: 400 })
            }

            try {
                await prisma.friendship.create({
                    data: {
                        requesterId: session.user.id,
                        addresseeId: targetUserId,
                        status: 'PENDING'
                    }
                })
            } catch (error) {
                // The preflight lookup and the unique pair constraint can race
                // when two tabs send the same request. Treat the winner as an
                // idempotent success instead of leaking a 500 to the client.
                if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
                    const winner = await prisma.friendship.findFirst({
                        where: {
                            OR: [
                                { requesterId: session.user.id, addresseeId: targetUserId },
                                { requesterId: targetUserId, addresseeId: session.user.id }
                            ]
                        }
                    })
                    if (winner && winner.requesterId === session.user.id && winner.addresseeId === targetUserId) {
                        return NextResponse.json({ success: true, replay: true, status: winner.status })
                    }
                }
                throw error
            }
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
    } catch {
        // Keep database/provider diagnostics out of logs and the response.
        console.error('[friends] Mutation failed.')
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
