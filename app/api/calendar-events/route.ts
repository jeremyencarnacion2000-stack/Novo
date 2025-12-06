import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseISO } from 'date-fns'
import { CalendarEvent } from '@/lib/data-integrator'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const events: CalendarEvent[] = []

    // 1. Projects
    const projects = await prisma.project.findMany({
      where: { userId: session.user.id },
      include: { subtasks: true }
    })
    projects.forEach((project) => {
      if (project.dueDate) {
        events.push({
          id: `proj-${project.id}`,
          title: `Project Due: ${project.title}`,
          date: parseISO(project.dueDate),
          type: 'project',
          completed: project.status === 'completed',
          metadata: { priority: project.priority }
        })
      }
      if (project.startDate) {
        events.push({
          id: `proj-start-${project.id}`,
          title: `Start: ${project.title}`,
          date: parseISO(project.startDate),
          type: 'project',
          completed: false,
          metadata: { isStart: true }
        })
      }
    })

    // 2. School Events
    const subjects = await prisma.schoolSubject.findMany({
      where: { userId: session.user.id },
      include: { events: true }
    })
    subjects.forEach((subject) => {
      if (subject.events) {
        subject.events.forEach((event) => {
          events.push({
            id: `school-${event.id}`,
            title: `${subject.name}: ${event.title}`,
            date: parseISO(event.date),
            type: 'school',
            completed: event.completed,
            metadata: { type: event.type }
          })
        })
      }
    })

    return NextResponse.json(events)
  } catch (error) {
    console.error('Error fetching calendar events:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
