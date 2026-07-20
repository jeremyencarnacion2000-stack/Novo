import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcrypt'
import * as jose from 'jose'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for') || 'unknown'
        const rl = rateLimit(`auth:mobile-login:${ip}`, 10, 300_000)
        if (!rl.allowed) return rateLimitResponse(rl);

        const { email, password } = await request.json()

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
        }

        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
        })

        if (!user || !user.password) {
            return NextResponse.json({ error: 'Invalid credentials or account linked with Google' }, { status: 401 })
        }

        const isPasswordValid = await bcrypt.compare(password, user.password)

        if (!isPasswordValid) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
        }

        // Generate a long-lived JWT for Mobile session (mirroring Google mobile route)
        const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET)
        const token = await new jose.SignJWT({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('30d') // 30 days for mobile sync
            .sign(secret)

        return NextResponse.json({
            success: true,
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                image: user.image
            }
        })

    } catch (error: any) {
        console.error('💥 [Mobile-Auth] Login failed:', error)
        return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
    }
}
