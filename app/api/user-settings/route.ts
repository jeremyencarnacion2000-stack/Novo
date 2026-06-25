import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateSettingsSchema = z.object({
    settings: z.record(z.unknown()),
})

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userSettings = await prisma.userSettings.findUnique({
            where: { userId: session.user.id }
        })

        if (!userSettings) {
            // Return default settings if none exist
            return NextResponse.json({ settings: null })
        }

        return NextResponse.json({ settings: userSettings.settings })
    } catch (error) {
        console.error('Error fetching user settings:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const parsed = updateSettingsSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
        }

        const { settings } = parsed.data

        // Upsert user settings
        const userSettings = await prisma.userSettings.upsert({
            where: { userId: session.user.id },
            update: { settings },
            create: {
                userId: session.user.id,
                settings
            }
        })

        return NextResponse.json({ success: true, settings: userSettings.settings })
    } catch (error) {
        console.error('Error saving user settings:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

