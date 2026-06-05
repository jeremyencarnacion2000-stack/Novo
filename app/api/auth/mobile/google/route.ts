import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { OAuth2Client } from 'google-auth-library'
import * as jose from 'jose'

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

export async function POST(request: NextRequest) {
    try {
        const { idToken } = await request.json()

        if (!idToken) {
            return NextResponse.json({ error: 'ID Token required' }, { status: 400 })
        }

        // Verify Google Token
        const ticket = await client.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        })
        const payload = ticket.getPayload()

        if (!payload || !payload.email) {
            return NextResponse.json({ error: 'Invalid Google Token' }, { status: 401 })
        }

        const email = payload.email.toLowerCase()
        const name = payload.name || 'Novo User'
        const image = payload.picture

        // Find or Create User
        let user = await prisma.user.findUnique({
            where: { email },
        })

        if (!user) {
            user = await prisma.user.create({
                data: {
                    email,
                    name,
                    image,
                    role: 'user',
                },
            })
        }

        // Generate a long-lived JWT for Mobile session
        // Note: Using 'jose' because it works in Edge Runtime
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

    } catch (error) {
        console.error('💥 [Mobile-Auth] Google verification failed:', error)
        return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
    }
}
