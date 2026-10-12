/**
 * @jest-environment node
 */

import { IntegrationEngine } from '../integration-engine'

const taskUpdateMany = jest.fn()
const routineTaskUpdateMany = jest.fn()
const subtaskUpdateMany = jest.fn()
const checklistFindFirst = jest.fn()
const checklistUpdateMany = jest.fn()
const routineFindMany = jest.fn()
const projectFindMany = jest.fn()
const checklistFindMany = jest.fn()
const taskFindMany = jest.fn()
const courseFindMany = jest.fn()
const actionPlanFindFirst = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    task: {
      updateMany: (...args: unknown[]) => taskUpdateMany(...args),
      findMany: (...args: unknown[]) => taskFindMany(...args),
      findFirst: jest.fn(),
    },
    routine: { findMany: (...args: unknown[]) => routineFindMany(...args) },
    project: { findMany: (...args: unknown[]) => projectFindMany(...args) },
    routineTask: { updateMany: (...args: unknown[]) => routineTaskUpdateMany(...args) },
    subtask: { updateMany: (...args: unknown[]) => subtaskUpdateMany(...args) },
    checklistItem: {
      findFirst: (...args: unknown[]) => checklistFindFirst(...args),
      updateMany: (...args: unknown[]) => checklistUpdateMany(...args),
      findMany: (...args: unknown[]) => checklistFindMany(...args),
    },
    course: { findMany: (...args: unknown[]) => courseFindMany(...args) },
    actionPlan: { findFirst: (...args: unknown[]) => actionPlanFindFirst(...args) },
  },
}))

jest.mock('@/lib/twin-signal', () => ({ emitTwinSignal: jest.fn() }))

describe('IntegrationEngine completion ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    routineFindMany.mockResolvedValue([])
    projectFindMany.mockResolvedValue([])
    checklistFindMany.mockResolvedValue([])
    taskFindMany.mockResolvedValue([])
    courseFindMany.mockResolvedValue([])
    actionPlanFindFirst.mockResolvedValue(null)
  })

  it('only surfaces scheduled routines on their selected weekday', async () => {
    const weekday = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()]
    const otherWeekday = weekday === 'monday' ? 'tuesday' : 'monday'
    routineFindMany.mockResolvedValue([
      {
        id: 'routine-today', name: 'Today routine', timeOfDay: 'morning', scheduledTime: '07:30', daysOfWeek: JSON.stringify([weekday]),
        tasks: [{ id: 'task-today', text: 'Show me', completed: false }],
      },
      {
        id: 'routine-other', name: 'Other routine', timeOfDay: 'morning', scheduledTime: null, daysOfWeek: JSON.stringify([otherWeekday]),
        tasks: [{ id: 'task-other', text: 'Do not show me', completed: false }],
      },
    ])

    const tasks = await IntegrationEngine.getTodayTasks('user-a')

    expect(tasks.map((task) => task.text)).toEqual(['Show me'])
    expect(tasks[0]?.scheduledHour).toBe(7)
  })

  it('keeps Todoist checklist items in the Today feed', async () => {
    checklistFindMany.mockResolvedValue([
      { id: 'todoist-1', text: 'Review inbox', completed: false, priority: 'high', source: 'todoist', dueDate: null },
    ])

    const tasks = await IntegrationEngine.getTodayTasks('user-a')

    expect(tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'checklist:todoist-1', source: 'todoist', text: 'Review inbox' }),
    ]))
  })

  it('does not duplicate a task that also has a linked legacy checklist row', async () => {
    taskFindMany.mockResolvedValue([
      { id: 'task-1', title: 'Canonical task', status: 'todo', priority: 'medium', dueDate: new Date().toISOString().slice(0, 10), scheduledHour: null, scheduledReason: null },
    ])
    checklistFindMany.mockResolvedValue([
      { id: 'checklist-1', taskId: 'task-1', text: 'Canonical task', completed: false, priority: 'medium', source: 'manual', dueDate: null },
    ])

    const tasks = await IntegrationEngine.getTodayTasks('user-a')

    expect(tasks.filter((task) => task.text === 'Canonical task')).toHaveLength(1)
    expect(tasks[0]).toEqual(expect.objectContaining({ id: 'task:task-1', source: 'ai-task' }))
  })

  it('does not report success or mutate a task outside the authenticated owner', async () => {
    taskUpdateMany.mockResolvedValue({ count: 0 })

    await expect(IntegrationEngine.syncCompletion('user-b', 'task:task-a', true)).resolves.toBe(false)
    expect(taskUpdateMany).toHaveBeenCalledWith({
      where: { id: 'task-a', userId: 'user-b' },
      data: { status: 'done' },
    })
  })

  it('updates only an owned task and returns success for the matching source', async () => {
    taskUpdateMany.mockResolvedValue({ count: 1 })

    await expect(IntegrationEngine.syncCompletion('user-a', 'task:task-a', false)).resolves.toBe(true)
    expect(taskUpdateMany).toHaveBeenCalledWith({
      where: { id: 'task-a', userId: 'user-a' },
      data: { status: 'todo' },
    })
  })

  it('checks ownership on routine, project, and checklist sources', async () => {
    routineTaskUpdateMany.mockResolvedValue({ count: 0 })
    subtaskUpdateMany.mockResolvedValue({ count: 0 })
    checklistFindFirst.mockResolvedValue(null)

    await expect(IntegrationEngine.syncCompletion('user-b', 'routine:routine-a:task:task-a', true)).resolves.toBe(false)
    await expect(IntegrationEngine.syncCompletion('user-b', 'project:project-a:subtask:subtask-a', true)).resolves.toBe(false)
    await expect(IntegrationEngine.syncCompletion('user-b', 'checklist:item-a', true)).resolves.toBe(false)

    expect(routineTaskUpdateMany).toHaveBeenCalledWith({
      where: { id: 'task-a', routine: { id: 'routine-a', userId: 'user-b' } },
      data: { completed: true },
    })
    expect(subtaskUpdateMany).toHaveBeenCalledWith({
      where: { id: 'subtask-a', project: { id: 'project-a', userId: 'user-b' } },
      data: { completed: true },
    })
    expect(checklistFindFirst).toHaveBeenCalledWith({ where: { id: 'item-a', userId: 'user-b' } })
    expect(checklistUpdateMany).not.toHaveBeenCalled()
  })
})
