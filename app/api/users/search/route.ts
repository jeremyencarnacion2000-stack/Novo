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

        const { searchParams } = new URL(request.url)
        const query = searchParams.get('q')

        if (!query || query.length < 2) {
            return NextResponse.json([])
        }

        const users = await prisma.user.findMany({
            where: {
                AND: [
                    {
                        OR: [
                            { name: { contains: query, mode: 'insensitive' } },
                            { email: { contains: query, mode: 'insensitive' } }
                        ]
                    },
                    { isPublic: true },
                    { id: { not: session.user.id } }
                ]
            },
            select: {
                id: true,
                name: true,
                image: true,
                bio: true
            },
            take: 10
        })

        return NextResponse.json(users)
    } catch (error) {
        console.error('Error searching users:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
