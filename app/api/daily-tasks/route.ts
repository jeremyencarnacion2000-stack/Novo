import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isSameDay, parseISO } from 'date-fns'
import { IntegratedTask } from '@/lib/data-integrator'
import { z } from 'zod'

const getDailyTasksSchema = z.object({
  date: z.string().datetime('Invalid date').optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const parsedParams = getDailyTasksSchema.safeParse(Object.fromEntries(searchParams))

    if (!parsedParams.success) {
      return NextResponse.json({ error: parsedParams.error.format() }, { status: 400 })
    }

    const { date: dateParam } = parsedParams.data
    const date = dateParam ? parseISO(dateParam) : new Date()

    const tasks: IntegratedTask[] = []

    // 1. Get Manual Checklist Items
    const manualItems = await prisma.checklistItem.findMany({
      where: { userId: session.user.id },
      include: {
        task: {
          include: {
            project: true
          }
        }
      }
    })
    manualItems.forEach((item) => {
      tasks.push({
        ...item,
        source: item.task ? 'project-task' : 'manual',
        metadata: item.task?.project ? {
          projectName: item.task.project.title
        } : undefined
      })
    })

    // 2. Get Routine Tasks
    const routines = await prisma.routine.findMany({
      where: { userId: session.user.id, isActive: true },
      include: { tasks: true }
    })
    routines.forEach((routine) => {
      routine.tasks.forEach((task) => {
        tasks.push({
          id: `routine-${routine.id}-${task.id}`,
          text: task.text,
          completed: task.completed,
          priority: 'medium',
          source: 'routine',
          sourceId: routine.id,
          originalId: task.id,
          metadata: {
            routineName: routine.name
          }
        })
      })
    })

    // 3. Get Project Subtasks (Due Today or In Progress)
    const projects = await prisma.project.findMany({
      where: { userId: session.user.id },
      include: { subtasks: true }
    })
    projects.forEach((project) => {
      if (project.status === 'in-progress') {
        project.subtasks.forEach((subtask) => {
          tasks.push({
            id: `project-${project.id}-${subtask.id}`,
            text: subtask.title,
            completed: subtask.completed,
            priority: project.priority,
            source: 'project',
            sourceId: project.id,
            originalId: subtask.id,
            metadata: {
              projectName: project.title,
              dueDate: project.dueDate
            }
          })
        })
      }
    })

    // 4. Get School Events (Due Today)
    const subjects = await prisma.schoolSubject.findMany({
      where: { userId: session.user.id },
      include: { events: true }
    })
    subjects.forEach((subject) => {
      if (subject.events) {
        subject.events.forEach((event) => {
          if (isSameDay(parseISO(event.date), date)) {
            tasks.push({
              id: `school-${subject.id}-${event.id}`,
              text: `${event.type === 'exam' ? 'Exam: ' : 'Assignment: '}${event.title}`,
              completed: event.completed,
              priority: 'high',
              source: 'school',
              sourceId: subject.id,
              originalId: event.id,
              metadata: {
                subjectName: subject.name
              }
            })
          }
        })
      }
    })

    // 5. Get Standalone Tasks
    const standaloneTasks = await prisma.task.findMany({
      where: { userId: session.user.id }
    })
    standaloneTasks.forEach((task) => {
      const isRelevant =
        task.status !== "done" || (task.dueDate && isSameDay(parseISO(task.dueDate), date))

      if (isRelevant) {
        tasks.push({
          id: `task-${task.id}`,
          text: task.title,
          completed: task.status === "done",
          priority: task.priority,
          source: "standalone",
          sourceId: "standalone",
          originalId: task.id,
          metadata: {
            projectName: "Standalone Task",
            dueDate: task.dueDate,
          },
        })
      }
    })

    return NextResponse.json(tasks)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error fetching daily tasks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}