import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcrypt'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { name, email, password } = body

        console.log('📝 [API-SignUp] Registration attempt for:', email)
        console.log('🕐 [API-SignUp] Timestamp:', new Date().toISOString())

        // Validate input
        if (!name || !email || !password) {
            console.warn('⚠️ [API-SignUp] Missing required fields')
            return NextResponse.json(
                { error: 'Todos los campos son requeridos' },
                { status: 400 }
            )
        }

        if (password.length < 6) {
            console.warn('⚠️ [API-SignUp] Password too short')
            return NextResponse.json(
                { error: 'La contraseña debe tener al menos 6 caracteres' },
                { status: 400 }
            )
        }

        // Check if user already exists
        console.log('🔍 [API-SignUp] Checking if user exists')
        const existingUser = await prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        })

        if (existingUser) {
            console.warn('⚠️ [API-SignUp] User already exists:', email)
            return NextResponse.json(
                { error: 'Este email ya está registrado' },
                { status: 409 }
            )
        }

        // Hash password
        console.log('🔐 [API-SignUp] Hashing password')
        const hashedPassword = await bcrypt.hash(password, 10)

        // Create user
        console.log('💾 [API-SignUp] Creating user in database')
        const user = await prisma.user.create({
            data: {
                name,
                email: email.toLowerCase(),
                password: hashedPassword,
                role: 'user'
            }
        })

        console.log('✅ [API-SignUp] User created successfully:', {
            id: user.id,
            email: user.email,
            name: user.name
        })

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        })
    } catch (error) {
        console.error('💥 [API-SignUp] Exception during registration:', error)
        console.error('📊 [API-SignUp] Error details:', {
            name: (error as Error).name,
            message: (error as Error).message,
            stack: (error as Error).stack
        })
        return NextResponse.json(
            { error: 'Error al crear la cuenta' },
            { status: 500 }
        )
    }
}
