import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { emailService } from '@/lib/email'

const requestSchema = z.object({ email: z.string().trim().email().max(320) })
const TOKEN_TTL_MS = 60 * 60 * 1000
const IDENTIFIER_PREFIX = 'password-reset:'

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const limit = rateLimit(`auth:password:forgot:${ip}`, 5, 15 * 60 * 1000)
  if (!limit.allowed) return rateLimitResponse(limit)

  try {
    const parsed = requestSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 })

    const email = parsed.data.email.toLowerCase()
    const genericResponse = NextResponse.json({
      message: 'If an account exists for that email, a reset link is on its way.',
    })
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, password: true } })
    if (!user?.password) return genericResponse

    const rawToken = randomBytes(32).toString('hex')
    const token = hashToken(rawToken)
    const identifier = `${IDENTIFIER_PREFIX}${email}`
    await prisma.$transaction(async (tx) => {
      await tx.verificationToken.deleteMany({ where: { identifier } })
      await tx.verificationToken.create({
        data: { identifier, token, expires: new Date(Date.now() + TOKEN_TTL_MS) },
      })
    })

    const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin
    const resetUrl = `${baseUrl}/auth/reset-password?token=${encodeURIComponent(rawToken)}`
    void emailService.sendPasswordReset(email, resetUrl).catch(() => {
      // Keep the public response generic and never log reset URLs or provider details.
      console.warn('[Auth] Password reset email unavailable.')
    })
    return genericResponse
  } catch {
    console.error('[Auth] Password reset request failed.')
    return NextResponse.json({ error: 'Unable to process the request right now.' }, { status: 500 })
  }
}
