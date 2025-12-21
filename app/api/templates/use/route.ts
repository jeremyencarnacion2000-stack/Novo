import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defaultTemplates } from '@/lib/templates'

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { templateId } = body

        const template = defaultTemplates.find(t => t.id === templateId)
        if (!template) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 })
        }

        // Instantiate based on type
        if (template.type === 'routine') {
            const routine = await prisma.routine.create({
                data: {
                    userId: session.user.id,
                    name: template.name,
                    description: template.description || '',
                    timeOfDay: 'morning', // Default
                    duration: template.content.tasks.reduce((acc: number, t: any) => acc + (t.duration || 0), 0),
                    isActive: true,
                    tasks: {
                        create: template.content.tasks.map((t: any) => ({
                            text: t.text,
                            completed: false
                        }))
                    }
                }
            })
            return NextResponse.json({ success: true, type: 'routine', id: routine.id })
        }

        if (template.type === 'project') {
            const project = await prisma.project.create({
                data: {
                    userId: session.user.id,
                    title: template.name,
                    description: template.description || '',
                    status: 'not-started',
                    priority: 'medium',
                    tags: '[]',
                    tasks: {
                        create: template.content.tasks.map((t: any) => ({
                            title: t.title,
                            status: t.status,
                            priority: 'medium',
                            tags: '[]',
                            userId: session.user.id
                        }))
                    }
                }
            })
            return NextResponse.json({ success: true, type: 'project', id: project.id })
        }

        if (template.type === 'tracker') {
            const tracker = await prisma.tracker.create({
                data: {
                    userId: session.user.id,
                    name: template.content.name,
                    type: 'metric',
                    unit: template.content.unit,
                    goal: template.content.goal
                }
            })
            return NextResponse.json({ success: true, type: 'tracker', id: tracker.id })
        }

        return NextResponse.json({ error: 'Unknown template type' }, { status: 400 })
    } catch (error) {
        console.error('Error using template:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
