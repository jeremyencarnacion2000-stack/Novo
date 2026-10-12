import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcrypt'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

function isUniqueConstraintError(error: unknown): error is { code: string } {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

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

        try {
            await prisma.user.create({
                data: {
                    name,
                    email: email.toLowerCase(),
                    password: hashedPassword,
                    role: 'user'
                }
            })
        } catch (error) {
            // The preflight lookup is only a friendly fast path. The database
            // unique index remains authoritative when two signups race.
            if (isUniqueConstraintError(error)) {
                return NextResponse.json(
                    { error: 'Este email ya está registrado' },
                    { status: 409 }
                )
            }
            throw error
        }

        return NextResponse.json({ success: true }, { status: 201 })
    } catch {
        // Keep database/provider diagnostics out of logs and response bodies.
        console.error('[API-SignUp] Registration failed.')
        return NextResponse.json(
            { error: 'Error al crear la cuenta' },
            { status: 500 }
        )
    }
}
