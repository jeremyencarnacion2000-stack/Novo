import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ hasKiloAuth: false }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { kiloUserId: true }
    })

    return NextResponse.json({ hasKiloAuth: !!(user as any)?.kiloUserId })
  } catch (error) {
    console.error('Error checking Kilo auth:', error)
    return NextResponse.json({ hasKiloAuth: false }, { status: 500 })
  }
}