import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(_: Request, context: { params: Promise<{ tokenId: string }> }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tokenId } = await context.params
  const result = await prisma.mcpPersonalAccessToken.updateMany({
    where: { id: tokenId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })

  if (result.count === 0) return NextResponse.json({ error: 'Token not found' }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
