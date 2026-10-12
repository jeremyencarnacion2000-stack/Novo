import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import bcrypt from 'bcrypt'
import { prisma } from '@/lib/prisma'

const resetSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/i),
  password: z.string().min(12).max(200),
})

const IDENTIFIER_PREFIX = 'password-reset:'

export async function POST(request: NextRequest) {
  try {
    const parsed = resetSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'Invalid or expired reset link.' }, { status: 400 })

    const tokenHash = createHash('sha256').update(parsed.data.token).digest('hex')
    const updated = await prisma.$transaction(async (tx) => {
      // Read and consume in one transaction so a concurrent replay cannot
      // update the password twice or surface as an unexpected 500.
      const record = await tx.verificationToken.findUnique({ where: { token: tokenHash } })
      if (!record || !record.identifier.startsWith(IDENTIFIER_PREFIX) || record.expires <= new Date()) return false
      const consumed = await tx.verificationToken.deleteMany({ where: { token: tokenHash } })
      if (consumed.count !== 1) return false

      const email = record.identifier.slice(IDENTIFIER_PREFIX.length)
      const user = await tx.user.findUnique({ where: { email }, select: { id: true } })
      if (!user) return false
      const password = await bcrypt.hash(parsed.data.password, 12)
      await tx.user.update({ where: { id: user.id }, data: { password } })
      await tx.session.deleteMany({ where: { userId: user.id } })
      return true
    })

    if (!updated) return NextResponse.json({ error: 'Invalid or expired reset link.' }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch {
    console.error('[Auth] Password reset failed.')
    return NextResponse.json({ error: 'Unable to reset the password right now.' }, { status: 500 })
  }
}
