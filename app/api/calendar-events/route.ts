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

    // 2. School Courses
    const courses = await prisma.course.findMany({
      where: { userId: session.user.id },
      include: { grades: true }
    })
    courses.forEach((course) => {
      // Courses don't have events in this schema, but we can add the course itself
      // or its grades as events if they have dates.
      // For now, let's just use the course if it has a specific date (it doesn't in schema)
      // or grades.
      if (course.grades) {
        course.grades.forEach((grade: any) => {
          events.push({
            id: `school-${grade.id}`,
            title: `${course.name}: ${grade.name}`,
            date: grade.date, // grade.date is already a Date in Prisma
            type: 'school' as any,
            completed: true,
            metadata: { score: grade.score }
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
