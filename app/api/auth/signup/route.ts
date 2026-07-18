import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcrypt'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for') || 'unknown'
        const rl = rateLimit(`auth:signup:${ip}`, 5, 300_000)
        if (!rl.allowed) return rateLimitResponse(rl);

        const body = await request.json()
        const { name, email, password } = body

        // Validate input
        if (!name || !email || !password) {
            return NextResponse.json(
                { error: 'Todos los campos son requeridos' },
                { status: 400 }
            )
        }

        if (password.length < 12) {
            return NextResponse.json(
                { error: 'La contraseña debe tener al menos 12 caracteres' },
                { status: 400 }
            )
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        })

        if (existingUser) {
            return NextResponse.json(
                { error: 'Este email ya está registrado' },
                { status: 409 }
            )
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        await prisma.user.create({
            data: {
                name,
                email: email.toLowerCase(),
                password: hashedPassword,
                role: 'user'
            }
        })

        return NextResponse.json({ success: true }, { status: 201 })
    } catch (error) {
        // Message only — never log the submitted email/name/password.
        console.error('[API-SignUp] Registration error:', (error as Error).message)
        return NextResponse.json(
            { error: 'Error al crear la cuenta' },
            { status: 500 }
        )
    }
}
